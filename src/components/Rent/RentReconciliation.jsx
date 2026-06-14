import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../../utils';

/**
 * RentReconciliation — Phase 4
 * Expected (property.monthlyRent) vs received (recorded rent payments) per property/month.
 * Flags short / missing / late collections. Pure derived view — no persistence.
 *
 * Props:
 *   properties         array
 *   rentPayments       array
 *   getEffectiveStatus (p) => status string
 *   onRecordRent       (property, monthKey, cell) => void   // open the rent modal prefilled
 */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RENT_COLLECTING = ['occupied', 'lease-expired', 'month-to-month'];
const GRACE_DAY = 5; // a payment dated after the 5th of its rent month counts as "late"

export default function RentReconciliation({ properties, rentPayments, getEffectiveStatus, onRecordRent, incomeActuals }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-based
  const curKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
  const recordedThisMonth = rentPayments
    .filter(r => (r.status === 'paid' || r.status === 'partial') && (r.incomeType === 'rent' || !r.incomeType) && (r.datePaid || r.month || '').startsWith(curKey))
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const depositedThisMonth = (incomeActuals && incomeActuals.months && incomeActuals.months[curKey] && incomeActuals.months[curKey].total) || 0;
  const reconDiff = depositedThisMonth - recordedThisMonth;
  const [year, setYear] = useState(currentYear);

  // Properties we expect to collect rent on (current status + positive monthly rent).
  const rentProps = useMemo(
    () => properties.filter(p => RENT_COLLECTING.includes(getEffectiveStatus(p)) && (parseFloat(p.monthlyRent) || 0) > 0),
    [properties, getEffectiveStatus]
  );

  // Last column to show: current month if viewing this year, else December.
  const lastMonthIdx = year === currentYear ? currentMonthIdx : 11;
  const months = Array.from({ length: lastMonthIdx + 1 }, (_, i) => i);

  // received rent for a property in a given month (0-based idx) of `year`.
  // Matches incomeType 'rent' (or untyped legacy), on the rent-period month, status paid/partial.
  const cellFor = (prop, monthIdx) => {
    const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const expected = parseFloat(prop.monthlyRent) || 0;
    const matches = rentPayments.filter(r => {
      if (String(r.propertyId) !== String(prop.id)) return false;
      if (r.incomeType && r.incomeType !== 'rent') return false;
      if (r.status && r.status !== 'paid' && r.status !== 'partial') return false;
      const period = (r.month || r.datePaid || '');
      return period.startsWith(monthKey);
    });
    const received = matches.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const late = matches.some(r => {
      if (r.status === 'late') return true;
      if (r.datePaid) {
        const d = new Date(r.datePaid + 'T00:00:00');
        if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() > GRACE_DAY) return true;
      }
      return false;
    });
    const isFuture = year === currentYear && monthIdx > currentMonthIdx;

    let state; // paid | over | short | missing | future
    if (isFuture) state = 'future';
    else if (received === 0) state = 'missing';
    else if (received >= expected - 1) state = received > expected + 1 ? 'over' : 'paid';
    else state = 'short';

    return { expected, received, late, state, count: matches.length };
  };

  // Precompute the grid + per-property YTD rollups.
  const grid = useMemo(() => {
    return rentProps.map(p => {
      const cells = months.map(m => ({ monthIdx: m, ...cellFor(p, m) }));
      const billable = cells.filter(c => c.state !== 'future');
      const expectedYtd = billable.reduce((s, c) => s + c.expected, 0);
      const receivedYtd = billable.reduce((s, c) => s + c.received, 0);
      return { property: p, cells, expectedYtd, receivedYtd, varianceYtd: receivedYtd - expectedYtd };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentProps, rentPayments, year, lastMonthIdx]);

  const totalExpected = grid.reduce((s, r) => s + r.expectedYtd, 0);
  const totalReceived = grid.reduce((s, r) => s + r.receivedYtd, 0);
  const totalVariance = totalReceived - totalExpected;
  const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 100;

  // Flags: every non-future cell that's missing or short (and late-but-paid as informational).
  const flags = useMemo(() => {
    const out = [];
    grid.forEach(row => {
      row.cells.forEach(c => {
        if (c.state === 'missing' || c.state === 'short') {
          out.push({ property: row.property, monthIdx: c.monthIdx, ...c });
        } else if (c.late && (c.state === 'paid' || c.state === 'over')) {
          out.push({ property: row.property, monthIdx: c.monthIdx, ...c, lateOnly: true });
        }
      });
    });
    return out;
  }, [grid]);

  const cellStyles = {
    paid: 'bg-emerald-500/15 text-emerald-300',
    over: 'bg-teal-500/15 text-teal-300',
    short: 'bg-yellow-500/15 text-yellow-300',
    missing: 'bg-red-500/10 text-red-300/80',
    future: 'text-white/15',
  };

  const handleCell = (prop, c) => {
    if (c.state === 'future') return;
    const monthKey = `${year}-${String(c.monthIdx + 1).padStart(2, '0')}`;
    onRecordRent?.(prop, monthKey, c);
  };

  if (rentProps.length === 0) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6 text-center text-white/50 text-sm">
        No rent-collecting properties yet. Set a monthly rent on an occupied property to track collections.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + year selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Rent Reconciliation</h2>
          <p className="text-xs text-white/40">Expected vs collected per property. Tap a cell to record or fix a payment.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 rounded-lg bg-white/[0.06] text-white/60 hover:bg-white/10 text-sm">&lsaquo;</button>
          <span className="px-3 text-sm font-semibold text-white tabular-nums">{year}</span>
          <button onClick={() => setYear(y => Math.min(currentYear, y + 1))} disabled={year >= currentYear}
            className="w-8 h-8 rounded-lg bg-white/[0.06] text-white/60 hover:bg-white/10 text-sm disabled:opacity-30">&rsaquo;</button>
        </div>
      </div>

      {/* Bank-deposit reconcile (this month) — from mikesmoney via the Rupert bridge */}
      {incomeActuals && (
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${Math.abs(reconDiff) < 1 ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-amber-400/40 bg-amber-500/10'}`}>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/50">This month · bank reconcile</div>
            <div className="text-sm text-white/85 mt-0.5">Recorded <b>{formatCurrency(recordedThisMonth)}</b> · Deposited <b>{formatCurrency(depositedThisMonth)}</b></div>
          </div>
          <div className={`text-sm font-bold ${Math.abs(reconDiff) < 1 ? 'text-emerald-400' : 'text-amber-300'}`}>
            {Math.abs(reconDiff) < 1 ? 'matched ✓' : `${reconDiff > 0 ? '+' : ''}${formatCurrency(reconDiff)}`}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Expected {year}</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(totalExpected)}</div>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Collected</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalReceived)}</div>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Variance</div>
          <div className={`text-xl font-bold mt-1 ${totalVariance < 0 ? 'text-red-400' : 'text-teal-400'}`}>
            {totalVariance < 0 ? '-' : ''}{formatCurrency(Math.abs(totalVariance))}
          </div>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Collection rate</div>
          <div className={`text-xl font-bold mt-1 ${collectionRate >= 100 ? 'text-emerald-400' : collectionRate >= 90 ? 'text-yellow-400' : 'text-red-400'}`}>{collectionRate}%</div>
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3 text-[11px] text-white/40 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/30 inline-block" /> Paid</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/30 inline-block" /> Short</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/25 inline-block" /> Missing</span>
          <span className="flex items-center gap-1"><span className="text-orange-400">&#9679;</span> Late</span>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th className="text-left text-white/40 font-semibold uppercase tracking-wider py-1 pr-3 whitespace-nowrap">Property</th>
                {months.map(m => (
                  <th key={m} className={`text-center font-semibold uppercase py-1 px-1 ${m === currentMonthIdx && year === currentYear ? 'text-amber-400' : 'text-white/40'}`}>{MONTH_NAMES[m]}</th>
                ))}
                <th className="text-right text-white/40 font-semibold uppercase tracking-wider py-1 pl-3 whitespace-nowrap">YTD &Delta;</th>
              </tr>
            </thead>
            <tbody>
              {grid.map(row => (
                <tr key={row.property.id}>
                  <td className="py-1 pr-3 text-white/80 font-medium whitespace-nowrap">
                    {row.property.emoji || '🏠'} {row.property.name}
                    <span className="block text-[10px] text-white/30">{formatCurrency(parseFloat(row.property.monthlyRent) || 0)}/mo</span>
                  </td>
                  {row.cells.map(c => (
                    <td key={c.monthIdx} className="p-0">
                      <button
                        onClick={() => handleCell(row.property, c)}
                        disabled={c.state === 'future'}
                        title={c.state === 'future' ? '' :
                          `${MONTH_NAMES[c.monthIdx]} ${year} — ${formatCurrency(c.received)} of ${formatCurrency(c.expected)}${c.late ? ' (late)' : ''}`}
                        className={`relative w-full min-w-[44px] h-9 rounded-lg text-center font-medium transition ${cellStyles[c.state]} ${c.state !== 'future' ? 'hover:ring-1 hover:ring-white/30 cursor-pointer' : 'cursor-default'}`}
                      >
                        {c.state === 'future' ? '·'
                          : c.state === 'missing' ? '—'
                          : formatCurrency(c.received).replace(/\.00$/, '')}
                        {c.late && c.state !== 'future' && c.state !== 'missing' && (
                          <span className="absolute top-0.5 right-1 text-orange-400 text-[9px] leading-none">&#9679;</span>
                        )}
                      </button>
                    </td>
                  ))}
                  <td className={`py-1 pl-3 text-right font-bold whitespace-nowrap ${row.varianceYtd < 0 ? 'text-red-400' : 'text-teal-400'}`}>
                    {row.varianceYtd === 0 ? '—' : `${row.varianceYtd < 0 ? '-' : '+'}${formatCurrency(Math.abs(row.varianceYtd))}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flags */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
        <h3 className="text-base font-bold text-white mb-3">
          Needs attention {flags.length > 0 && <span className="text-white/40 font-normal">({flags.length})</span>}
        </h3>
        {flags.length === 0 ? (
          <p className="text-sm text-emerald-400/80">✓ All collected rent reconciles for {year}.</p>
        ) : (
          <div className="space-y-2">
            {flags.map((f, i) => {
              const label = f.lateOnly ? 'Late' : f.state === 'missing' ? 'Missing' : 'Short';
              const color = f.lateOnly ? 'text-orange-400' : f.state === 'missing' ? 'text-red-400' : 'text-yellow-400';
              const detail = f.lateOnly
                ? `Collected ${formatCurrency(f.received)} after the ${GRACE_DAY}th`
                : f.state === 'missing'
                  ? `No payment recorded — ${formatCurrency(f.expected)} expected`
                  : `${formatCurrency(f.received)} of ${formatCurrency(f.expected)} (${formatCurrency(f.expected - f.received)} short)`;
              return (
                <button key={i} onClick={() => handleCell(f.property, f)}
                  className="w-full flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.07] rounded-xl px-3 py-2 text-left transition">
                  <div>
                    <span className="text-sm text-white/80">{f.property.emoji || '🏠'} {f.property.name}</span>
                    <span className="text-xs text-white/40 ml-2">{MONTH_NAMES[f.monthIdx]} {year}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${color}`}>{label}</div>
                    <div className="text-[11px] text-white/40">{detail}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
