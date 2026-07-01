import React from 'react';
import { Plus, TrendingUp, TrendingDown, Edit3, Users } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils';

// Properties whose name matches this are excluded from the pooled ownership/equity calc
const isExcludedFromOwnership = (property) =>
  (property.name || '').toLowerCase().includes('governor');

export default function OwnershipView({ properties, investors, onAdd, onEdit }) {
  const includedProperties = (properties || []).filter(p => !isExcludedFromOwnership(p));
  const excludedProperties = (properties || []).filter(isExcludedFromOwnership);

  const totalCurrentValue = includedProperties.reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0);
  const totalMortgageBalance = includedProperties.reduce((s, p) => s + (parseFloat(p.mortgageBalance) || 0), 0);
  const totalPurchasePrice = includedProperties.reduce((s, p) => s + (parseFloat(p.purchasePrice) || 0), 0);
  const totalCurrentEquity = totalCurrentValue - totalMortgageBalance;

  const computeStake = (inv) => {
    const basis = parseFloat(inv.equityBasisAtContribution) || 0;
    const contribution = parseFloat(inv.contributionAmount) || 0;
    const pct = basis > 0 ? contribution / basis : 0;
    const currentStakeValue = pct * totalCurrentEquity;
    const growth = currentStakeValue - contribution;
    const growthPct = contribution > 0 ? (growth / contribution) * 100 : 0;
    return { pct, currentStakeValue, growth, growthPct };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Ownership Stakes</h2>
          <p className="text-xs text-white/40 mt-0.5">Tracks outside investors' (e.g. family) capital contributions against portfolio equity over time</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
        >
          <Plus className="w-4 h-4" /> Add Stake
        </button>
      </div>

      {/* Portfolio equity summary */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-white/70 mb-3">Pooled Portfolio Equity (today)</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Market Value</p>
            <p className="text-base font-bold text-white">{formatCurrency(totalCurrentValue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Mortgage Balance</p>
            <p className="text-base font-bold text-red-400/80">{formatCurrency(totalMortgageBalance)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Total Equity</p>
            <p className="text-base font-bold text-emerald-400">{formatCurrency(totalCurrentEquity)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-1">
          {includedProperties.map(p => (
            <span key={p.id} className="text-[11px] px-2 py-1 bg-white/[0.06] rounded-lg text-white/50">
              {p.emoji || '🏠'} {p.name}
            </span>
          ))}
        </div>
        {excludedProperties.length > 0 && (
          <p className="text-[11px] text-white/30 mt-2">
            Excluded from ownership pool: {excludedProperties.map(p => p.name).join(', ')}
          </p>
        )}
        <p className="text-[11px] text-white/30 mt-1">
          Equity model: full market equity (value − mortgage balance), so stakes move with both
          paydown and appreciation/depreciation. Cost basis was {formatCurrency(totalPurchasePrice)}.
        </p>
      </div>

      {/* Investor stake cards */}
      {investors.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No investor stakes tracked yet</p>
          <button onClick={onAdd} className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm hover:bg-emerald-600 transition">
            Add First Stake
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {investors.map(inv => {
            const { pct, currentStakeValue, growth, growthPct } = computeStake(inv);
            const isUp = growth >= 0;
            return (
              <div key={inv.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-white font-bold">{inv.name}</h4>
                    <p className="text-xs text-white/40 mt-0.5">
                      Contributed {formatCurrency(inv.contributionAmount)}
                      {inv.contributionDate ? ` on ${formatDate(inv.contributionDate)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => onEdit(inv)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-white/40" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-2">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Fixed Stake</p>
                    <p className="text-base font-bold text-amber-400">{(pct * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Value Today</p>
                    <p className="text-base font-bold text-white">{formatCurrency(currentStakeValue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Growth</p>
                    <p className={`text-base font-bold flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {isUp ? '+' : ''}{formatCurrency(growth)}
                      <span className="text-[11px] font-normal opacity-70">({isUp ? '+' : ''}{growthPct.toFixed(1)}%)</span>
                    </p>
                  </div>
                </div>

                {inv.notes && <p className="text-xs text-white/40 mt-2 border-t border-white/[0.06] pt-2">{inv.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
