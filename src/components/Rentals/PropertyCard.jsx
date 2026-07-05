import React, { useState } from 'react';
import { MoreVertical, MapPin, DollarSign, Trash2, Edit3, Eye, FileText, Clock, Users } from 'lucide-react';
import { propertyStatuses, expenseCategories } from '../../constants';
import { getPropertyTenants } from '../../hooks/useProperties';

const formatCur = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const PropertyCard = ({ property, onEdit, onDelete, onViewDetails, documents = [], onViewDocument, expenses = [], rentPayments = [] }) => {
  const [showMenu, setShowMenu] = useState(false);

  const tenants = getPropertyTenants(property);

  // Financial calculations
  const currentYear = new Date().getFullYear();
  const propId = String(property.id);
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);

  const propExpenses = (expenses || [])
    .filter(e => String(e.propertyId) === propId && e.isTemplate !== true)
    .filter(e => e.date && e.date.startsWith(String(currentYear)));
  const ytdExpenses = propExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  // Cash-flow math: the expense ledger ALREADY records mortgage payments (recurring
  // templates), and the property record's mortgageMonthlyPayment is added separately
  // below — so the monthly average must EXCLUDE mortgage-category expenses or the
  // mortgage gets subtracted twice. (ytdExpenses/ytdProfit keep everything: they're
  // the true ledger P&L and don't add the property-level payment on top.)
  // …but only when a property-level payment is actually configured; otherwise the
  // ledger's mortgage rows are the only place the mortgage is counted, so keep them.
  const hasPropertyMortgagePayment = (parseFloat(property.mortgageMonthlyPayment) || 0) > 0;
  const operatingExpenses = propExpenses.filter(e => !hasPropertyMortgagePayment || e.category !== 'mortgage');

  // Big one-time items (≥$1,000 single expense — roof, HVAC, major plumbing) are CAPITAL/
  // exceptional: averaging them into "monthly" cash flow makes a structurally fine property
  // look like it loses money every month. Exclude from the monthly view, disclose below.
  const CAPEX_THRESHOLD = 1000;
  const oneTimeItems = operatingExpenses.filter(e => (parseFloat(e.amount) || 0) >= CAPEX_THRESHOLD);
  const oneTimeTotal = oneTimeItems.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const recurringOps = operatingExpenses.filter(e => (parseFloat(e.amount) || 0) < CAPEX_THRESHOLD);

  // Per-category monthly averages (YTD basis — becomes trailing-12-mo once a year of data exists)
  const opsByCategory = {};
  for (const e of recurringOps) {
    const c = e.category || 'other';
    opsByCategory[c] = (opsByCategory[c] || 0) + (parseFloat(e.amount) || 0);
  }
  const opsCatLines = Object.entries(opsByCategory)
    .map(([cat, tot]) => ({ cat, avg: tot / monthsElapsed }))
    .sort((a, b) => b.avg - a.avg);
  const avgMonthlyExpenses = opsCatLines.reduce((s, l) => s + l.avg, 0);

  const ytdRent = (rentPayments || [])
    .filter(p => String(p.propertyId) === propId && ['paid', 'partial'].includes(p.status))
    .filter(p => { const d = p.datePaid || p.month; return d && d.startsWith(String(currentYear)); })
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const ytdProfit = ytdRent - ytdExpenses;

  // Vacant/renovation properties collect no rent — monthlyRent is MARKET rent, not
  // actual, so it must not flow into cash flow (a vacant unit was showing +$1,300/mo).
  const monthlyRent = parseFloat(property.monthlyRent) || 0;
  const statusNow = property.propertyStatus || (tenants.length > 0 ? 'occupied' : 'vacant');
  const isCollecting = ['occupied', 'lease-expired', 'month-to-month'].includes(statusNow);
  const effectiveRent = isCollecting ? monthlyRent : 0;

  const mortgagePayment = parseFloat(property.mortgageMonthlyPayment) || 0;
  const escrow = parseFloat(property.escrowMonthly) || 0;
  // Non-escrowed taxes/insurance (e.g. Hillcrest — Rocket payment is pure P&I):
  // paid separately, usually annually, so they never show in the monthly ledger.
  const taxInsMonthly = property.taxesInsNotEscrowed
    ? ((parseFloat(property.annualPropertyTax) || 0) + (parseFloat(property.annualInsurance) || 0)) / 12 : 0;
  const noi = effectiveRent - avgMonthlyExpenses - taxInsMonthly;  // Net Operating Income
  const monthlyCashFlow = noi - mortgagePayment - escrow;          // after debt service

  const purchasePrice = parseFloat(property.purchasePrice) || 0;
  const currentValue = parseFloat(property.currentValue) || 0;
  const equityGain = currentValue - purchasePrice;
  const equityPct = purchasePrice > 0 ? ((equityGain / purchasePrice) * 100).toFixed(1) : 0;
  const mortgageBalance = parseFloat(property.mortgageBalance) || 0;
  const mortgageAPR = parseFloat(property.mortgageAPR) || 0;

  // Lease document
  const leaseDoc = documents.find(
    d => String(d.propertyId) === String(property.id) && d.type === 'lease' && d.fileUrl
  );

  // Property status
  const propStatus = property.propertyStatus || (tenants.length > 0 ? 'occupied' : 'vacant');
  const statusObj = propertyStatuses.find(s => s.value === propStatus) || propertyStatuses[1];

  // Lease countdown
  const getLeaseInfo = () => {
    const activeTenants = tenants.filter(t => t.leaseEnd);
    if (activeTenants.length === 0) return null;
    const soonest = [...activeTenants].sort((a, b) => a.leaseEnd.localeCompare(b.leaseEnd))[0];
    const end = new Date(soonest.leaseEnd + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return { days, name: soonest.name };
  };
  const leaseInfo = getLeaseInfo();

  const hasMortgageData = property.hasMortgage && (mortgageBalance > 0 || mortgagePayment > 0);

  // Color by property type: purple for single-family, teal for condos/everything else
  const typeGradient = property.type === 'single-family'
    ? 'from-purple-400 to-violet-500'
    : 'from-teal-400 to-cyan-500';

  return (
    <div
      className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.05] transition cursor-pointer group"
      onClick={() => onViewDetails()}
    >
      {/* Color bar — spans full width */}
      <div className={`h-1.5 bg-gradient-to-r ${typeGradient}`} />

      <div className="flex flex-col md:flex-row">
        {/* LEFT — Property Info */}
        <div className="md:w-[62%] flex flex-col">
          <div className="flex items-start p-4 gap-3">
            {/* Photo thumbnail */}
            {property.photo ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                <img src={property.photo} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-14 h-14 rounded-xl flex-shrink-0 bg-gradient-to-br ${typeGradient} flex items-center justify-center`}>
                <span className="text-xl">{property.emoji || '🏠'}</span>
              </div>
            )}

            {/* Name, address, status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-sm truncate leading-tight">{property.name}</h3>
                  <p className="text-[11px] text-white/40 truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {property.street}{property.city ? `, ${property.city}` : ''}
                  </p>
                </div>
                {/* Menu */}
                <div className="relative ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-white/10 rounded-lg transition">
                    <MoreVertical className="w-4 h-4 text-white/40" />
                  </button>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-40 bg-slate-800 border border-white/15 rounded-xl shadow-2xl min-w-[120px] py-1">
                        <button onClick={() => { setShowMenu(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => { setShowMenu(false); onViewDetails(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button onClick={() => { setShowMenu(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Status + lease */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusObj.bg} ${statusObj.color} ${statusObj.border}`}>
                  {statusObj.label}
                </span>
                {leaseInfo && (
                  <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                    leaseInfo.days <= 0 ? 'text-red-400' : leaseInfo.days <= 30 ? 'text-orange-400' : leaseInfo.days <= 90 ? 'text-yellow-400' : 'text-white/30'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {leaseInfo.days <= 0 ? 'Expired' : `${leaseInfo.days}d`}
                  </span>
                )}
                {leaseDoc && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewDocument ? onViewDocument(leaseDoc) : window.open(leaseDoc.fileUrl, '_blank'); }}
                    className="text-blue-400 hover:text-blue-300 transition"
                    title="View Lease"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Lease dates */}
              {(() => {
                const activeTenants = tenants.filter(t => t.leaseStart || t.leaseEnd);
                if (activeTenants.length === 0) return null;
                const t = activeTenants[0];
                const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                return (
                  <p className="text-[10px] text-white/35 mt-1">
                    Lease: {fmt(t.leaseStart)} – {fmt(t.leaseEnd)}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Tenants + Rent footer */}
          <div className="px-4 pb-3 flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <span className="text-xs text-white/50 truncate">
                {tenants.length > 0 ? tenants.map(t => t.name).filter(Boolean).join(', ') : 'No tenants'}
              </span>
            </div>
            <div className="flex items-center gap-0.5 text-emerald-400 font-semibold text-sm flex-shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{monthlyRent ? monthlyRent.toLocaleString() : '0'}/mo</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Financial Analysis Panel */}
        <div className="md:w-[38%] p-4 border-t md:border-t-0 md:border-l border-white/[0.08] bg-white/[0.02]">
          {/* Cash Flow headline */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">Cash Flow</span>
            <span className={`text-lg font-bold ${monthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {monthlyCashFlow >= 0 ? '+' : ''}{formatCur(monthlyCashFlow)}
            </span>
          </div>

          {/* Monthly snapshot: Rent − operating expenses = NOI, then − debt service */}
          <div className="space-y-1 mb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">{isCollecting ? 'Rent' : 'Market Rent (vacant)'}</span>
              {isCollecting
                ? <span className="text-emerald-400 font-medium">{formatCur(monthlyRent)}</span>
                : <span className="text-white/30 font-medium line-through">{formatCur(monthlyRent)}</span>}
            </div>
            {opsCatLines.slice(0, 3).map(l => {
              const catObj = expenseCategories.find(c => c.value === l.cat);
              return (
                <div key={l.cat} className="flex items-center justify-between text-xs">
                  <span className="text-white/50">{catObj ? `${catObj.label}` : l.cat} <span className="text-white/25">avg</span></span>
                  <span className="text-red-400/70 font-medium">-{formatCur(l.avg)}</span>
                </div>
              );
            })}
            {opsCatLines.length > 3 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Other ops <span className="text-white/25">avg</span></span>
                <span className="text-red-400/70 font-medium">-{formatCur(opsCatLines.slice(3).reduce((s, l) => s + l.avg, 0))}</span>
              </div>
            )}
            {taxInsMonthly > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Taxes+Ins <span className="text-white/25">(not escrowed, est)</span></span>
                <span className="text-red-400/70 font-medium">-{formatCur(taxInsMonthly)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
              <span className="text-white/60 font-semibold">NOI</span>
              <span className={`font-semibold ${noi >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}`}>{noi >= 0 ? '' : '-'}{formatCur(Math.abs(noi))}</span>
            </div>
            {hasMortgageData && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Mortgage</span>
                <span className="text-red-400/70 font-medium">-{formatCur(mortgagePayment)}</span>
              </div>
            )}
            {escrow > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Escrow</span>
                <span className="text-red-400/70 font-medium">-{formatCur(escrow)}</span>
              </div>
            )}
            {oneTimeTotal > 0 && (
              <div className="text-[10px] text-amber-400/60 pt-1" title={oneTimeItems.map(e => `${e.date} · ${e.description || e.category} · ${formatCur(e.amount)}`).join('\n')}>
                One-time items this yr: {formatCur(oneTimeTotal)} (excluded from monthly avg{oneTimeItems.length > 1 ? `, ${oneTimeItems.length} items` : ''})
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] my-2" />

          {/* Valuation + Mortgage compact grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {purchasePrice > 0 && (
              <div>
                <p className="text-[10px] text-white/30">Purchase</p>
                <p className="text-xs text-white/70 font-medium">{formatCur(purchasePrice)}</p>
              </div>
            )}
            {currentValue > 0 && (
              <div>
                <p className="text-[10px] text-white/30">Value</p>
                <p className="text-xs text-white/70 font-medium">
                  {formatCur(currentValue)}
                  {purchasePrice > 0 && (
                    <span className={`ml-1 text-[10px] ${equityGain >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                      {equityGain >= 0 ? '▲' : '▼'}{Math.abs(equityPct)}%
                    </span>
                  )}
                </p>
              </div>
            )}
            {hasMortgageData && mortgageBalance > 0 && (
              <div>
                <p className="text-[10px] text-white/30">Loan Bal</p>
                <p className="text-xs text-white/70 font-medium">{formatCur(mortgageBalance)}</p>
              </div>
            )}
            {hasMortgageData && mortgageAPR > 0 && (
              <div>
                <p className="text-[10px] text-white/30">APR</p>
                <p className="text-xs text-white/70 font-medium">{mortgageAPR}%</p>
              </div>
            )}
          </div>

          {/* YTD P&L */}
          <div className="border-t border-white/[0.06] pt-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">YTD P&L</span>
              <span className={`font-bold ${ytdProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {ytdProfit >= 0 ? '+' : ''}{formatCur(ytdProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
