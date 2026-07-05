import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Sell-vs-hold analyzer — computes from the property records (purchase date/price,
// value, mortgage) + the expense ledger (recurring operating costs). Mirrors the
// analyzer in Mike's Money but lives on RR data so Liam sees the same picture.
// Not advice — a decision aid. Confirm depreciation/basis with the CPA.

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const DEFAULTS = { appreciationRate: 0.03, altReturn: 0.06, horizon: 10, sellingCostPct: 0.06, maintenancePct: 0.08, rentGrowth: 0.02, ltcgRate: 0.15, recaptureRate: 0.25, ncRate: 0.0425, buildingPct: 0.8 };

function monthlyPI(P, r, n) { if (!P || !r || !n) return 0; const i = r / 12; return P * i / (1 - Math.pow(1 + i, -n)); }
function yearsHeld(d) { return Math.max(0, (Date.now() - new Date(d + 'T00:00:00')) / (365.25 * 86400000)); }
function balanceIn(bal, rate, remM, yrs) { if (!bal || !rate) return bal || 0; const pmt = monthlyPI(bal, rate, remM); const i = rate / 12; let b = bal; for (let m = 0; m < Math.min(Math.round(yrs * 12), remM); m++) b = Math.max(0, b * (1 + i) - pmt); return b; }

function proceeds(p, a, years) {
  const saleValue = p.value * Math.pow(1 + (years ? a.appreciationRate : 0), years);
  const netSale = saleValue * (1 - a.sellingCostPct);
  const dep = Math.min(p.purchasePrice * a.buildingPct, (p.purchasePrice * a.buildingPct / 27.5) * (yearsHeld(p.purchaseDate) + years));
  const gain = Math.max(0, netSale - (p.purchasePrice - dep));
  const recapture = Math.min(dep, gain);
  const fedTax = recapture * a.recaptureRate + (gain - recapture) * a.ltcgRate;
  const ncTax = gain * a.ncRate;
  const loanBal = balanceIn(p.loan, p.rate, p.remMonths, years);
  return { netProceeds: netSale - loanBal - fedTax - ncTax, friction: (saleValue - netSale) + fedTax + ncTax, loanBal };
}

function analyze(p, a) {
  const sellNow = proceeds(p, a, 0);
  const fvSell = sellNow.netProceeds * Math.pow(1 + a.altReturn, a.horizon);
  const cf = (t) => p.rent * 12 * Math.pow(1 + a.rentGrowth, t - 1) * (1 - a.maintenancePct) - p.opex * 12 * Math.pow(1.02, t - 1) - (t * 12 <= p.remMonths ? p.debt * 12 : 0);
  let fvCF = 0; for (let t = 1; t <= a.horizon; t++) fvCF += cf(t) * Math.pow(1 + a.altReturn, a.horizon - t);
  const fvHold = fvCF + proceeds(p, a, a.horizon).netProceeds;
  let breakeven = null;
  for (let r = 0; r <= 0.1; r += 0.0025) {
    if (fvCF + proceeds(p, { ...a, appreciationRate: r }, a.horizon).netProceeds >= fvSell) { breakeven = r; break; }
  }
  return { sellNow, fvSell, fvHold, cfYear1: cf(1), breakeven, edge: fvHold - fvSell };
}

export default function SellVsHold({ db, properties, expenses, canManage, currentUser, showToast }) {
  const [a, setA] = useState(DEFAULTS);
  useEffect(() => {
    getDoc(doc(db, 'rentalData', 'analysis')).then(s => { if (s.exists() && s.data().sellHold) setA(x => ({ ...x, ...s.data().sellHold })); }).catch(() => {});
  }, [db]);
  const save = async () => {
    try { await setDoc(doc(db, 'rentalData', 'analysis'), { sellHold: a, lastUpdated: new Date().toISOString(), updatedBy: currentUser || 'unknown' }, { merge: true }); showToast('Assumptions saved', 'success'); }
    catch (e) { showToast('Save failed: ' + e.message, 'error'); }
  };

  const rows = useMemo(() => properties
    .filter(p => p.purchaseDate && parseFloat(p.purchasePrice) > 0 && parseFloat(p.mortgageBalance) >= 0 && parseFloat(p.monthlyRent) > 0)
    .map(prop => {
      const year = new Date().getFullYear();
      const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
      const ops = (expenses || [])
        .filter(e => String(e.propertyId) === String(prop.id) && e.isTemplate !== true && e.category !== 'mortgage')
        .filter(e => e.date && e.date.startsWith(String(year)) && (parseFloat(e.amount) || 0) < 1000)
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) / monthsElapsed;
      const p = {
        id: prop.id, name: prop.name,
        purchaseDate: prop.purchaseDate, purchasePrice: parseFloat(prop.purchasePrice),
        value: parseFloat(prop.currentValue) || parseFloat(prop.purchasePrice),
        loan: parseFloat(prop.mortgageBalance) || 0,
        rate: (parseFloat(prop.mortgageAPR) || 0) / 100,
        remMonths: 336, // ≈28 yrs left on the 2024 30-yr notes
        rent: parseFloat(prop.monthlyRent),
        debt: parseFloat(prop.mortgageMonthlyPayment) || 0,
        opex: ops,
      };
      return { p, r: analyze(p, a) };
    })
    .sort((x, y) => x.r.edge - y.r.edge), [properties, expenses, a]);

  if (!canManage || rows.length === 0) return null;

  const askRupert = () => {
    const lines = rows.map(({ p, r }) => {
      const v = r.edge > 15000 ? 'HOLD' : r.edge < -15000 ? 'SELL' : 'CLOSE CALL';
      return `• ${p.name}: bought ${p.purchaseDate.slice(0, 7)} for ${fmt(p.purchasePrice)}, value ${fmt(p.value)}, loan ${fmt(p.loan)} @${(p.rate * 100).toFixed(2)}%, rent ${fmt(p.rent)}/mo, cash flow ${fmt(Math.round(r.cfYear1 / 12))}/mo, sell-now nets ${fmt(Math.round(r.sellNow.netProceeds))}, breakeven appreciation ${r.breakeven == null ? '>10' : (r.breakeven * 100).toFixed(1)}%/yr → ${v} (${r.edge >= 0 ? '+' : ''}${fmt(Math.round(r.edge))} vs selling)`;
    }).join('\n');
    const prompt = `Rupert, review my rental sell-vs-hold analysis from Rainbow Reality:\n${lines}\nAssumptions: ${(a.altReturn * 100).toFixed(0)}% alternative return, ${a.horizon}-yr horizon, ${(a.sellingCostPct * 100).toFixed(0)}% selling costs, ${(a.appreciationRate * 100).toFixed(0)}% base appreciation, ${(a.maintenancePct * 100).toFixed(0)}% maintenance. Context: I'm 59½, starting IRA draws, and any sales should land before the 2029 IRMAA lookback window; Liam manages the properties. What's your read — which (if any) would you sell, in what order, and what am I missing?`;
    window.open('https://mikeslife.app/?rupert=1&ask=' + encodeURIComponent(prompt), '_blank', 'noopener');
  };

  return (
    <div className="mt-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="text-sm font-semibold text-white/70">⚖️ Sell vs Hold</h3>
        <div className="flex gap-2">
          <button onClick={askRupert} className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/25" title="Opens Rupert in Mike's Life with this analysis pre-loaded">🦚 Ask Rupert to review</button>
          <button onClick={save} className="px-3 py-1.5 rounded-xl bg-white/10 text-white/60 text-xs hover:bg-white/20">Save inputs</button>
        </div>
      </div>
      <p className="text-[11px] text-white/30 mb-3">From property records + this year's expense ledger. Breakeven = appreciation needed for holding to beat selling now and investing at {(a.altReturn * 100).toFixed(0)}%. Estimates — confirm basis/depreciation with the CPA.</p>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-[11px] mb-3">
        {[['appreciationRate', 'Appreciation'], ['altReturn', 'Alt return'], ['horizon', 'Horizon yrs'], ['sellingCostPct', 'Sell cost'], ['maintenancePct', 'Maint % rent'], ['rentGrowth', 'Rent growth']].map(([k, l]) => (
          <label key={k} className="block">
            <span className="text-white/30 block mb-0.5">{l}</span>
            <input type="number" step={k === 'horizon' ? 1 : 0.0025} value={a[k]}
              onChange={e => setA(s => ({ ...s, [k]: Number(e.target.value) || 0 }))}
              className="w-full px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-teal-500/50" />
          </label>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 text-[10px] uppercase tracking-wide">
              <th className="text-left py-1">Property</th>
              <th className="text-right px-2">Cash flow</th>
              <th className="text-right px-2">Sell now nets</th>
              <th className="text-right px-2">Breakeven appr.</th>
              <th className="text-right pl-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, r }) => {
              const v = r.edge > 15000 ? { t: 'HOLD', c: 'text-emerald-400' } : r.edge < -15000 ? { t: 'SELL', c: 'text-red-400' } : { t: 'CLOSE', c: 'text-amber-300' };
              return (
                <tr key={p.id} className="border-t border-white/[0.06]">
                  <td className="py-2 text-white/70">{p.name}<span className="block text-[10px] text-white/25">bought {p.purchaseDate.slice(0, 7)} · {fmt(p.purchasePrice)} · {(p.rate * 100).toFixed(2)}%</span></td>
                  <td className={`px-2 text-right ${r.cfYear1 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(Math.round(r.cfYear1 / 12))}/mo</td>
                  <td className="px-2 text-right text-white/80" title={`Friction ${fmt(Math.round(r.sellNow.friction))} · payoff ${fmt(Math.round(r.sellNow.loanBal))}`}>{fmt(Math.round(r.sellNow.netProceeds))}</td>
                  <td className="px-2 text-right text-white/60">{r.breakeven == null ? '>10%' : (r.breakeven * 100).toFixed(1) + '%'}</td>
                  <td className={`pl-2 text-right font-bold ${v.c}`}>{v.t}<span className="block text-[10px] font-normal text-white/25">{r.edge >= 0 ? '+' : ''}{fmt(Math.round(r.edge))}</span></td>
                </tr>
              );
            })}
            <tr className="border-t border-white/10">
              <td className="py-2 font-semibold text-white/70">Liquidate all</td>
              <td />
              <td className="px-2 text-right font-bold text-white">{fmt(Math.round(rows.reduce((s, { r }) => s + r.sellNow.netProceeds, 0)))}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
