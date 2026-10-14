import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Mail, Settings, Phone, StickyNote, Check } from 'lucide-react';
import { formatCurrency, formatDate, monthName, currentMonthKey, rentDueDateStr, todayLocalStr, timeAgo, parseLocalDate } from '../../utils';
import { getPropertyTenants, getLeaseTerms } from '../../hooks/useProperties';

const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const CHANNEL_ICON = { sms: MessageSquare, email: Mail, call: Phone, note: StickyNote };

/**
 * RentDay — one screen for the monthly collection loop: who's paid, who hasn't, and
 * one-tap Text / Email / Record per tenant, with the contact history right there.
 */
export default function RentDay({
  properties, rentPayments, commsLog = [], settings = {}, currentUser,
  onSaveSettings, onCompose, onRecord, canManage,
}) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [expanded, setExpanded] = useState({});
  const today = todayLocalStr();

  const rows = useMemo(() => {
    const rentProps = properties.filter(p =>
      ['occupied', 'lease-expired', 'month-to-month'].includes(
        p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant')
      ) && (parseFloat(p.monthlyRent) || 0) > 0
    );
    return rentProps.map(p => {
      const terms = getLeaseTerms(p, settings);
      const due = parseFloat(p.monthlyRent) || 0;
      const records = rentPayments.filter(r => String(r.propertyId) === String(p.id)
        && (!r.incomeType || r.incomeType === 'rent')
        && ['paid', 'partial', 'late'].includes(r.status)
        && (r.month || r.datePaid || '').startsWith(monthKey));
      const paid = records.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const settled = records.some(r => r.status === 'paid') || paid >= due - 0.005;
      const status = settled ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      const dueDate = rentDueDateStr(monthKey, terms.dueDay);
      const daysPast = Math.round((parseLocalDate(today) - parseLocalDate(dueDate)) / 86400000);
      const phase = daysPast < 0 ? 'upcoming' : daysPast === 0 ? 'due' : daysPast <= terms.graceDays ? 'grace' : 'late';
      const suggested = status === 'paid' ? 'receipt' : status === 'partial' ? 'partial'
        : phase === 'late' ? 'late' : phase === 'upcoming' ? 'upcoming' : 'due';
      const tenants = getPropertyTenants(p).filter(t => t.status !== 'vacant');
      const lastContact = (tenant) => commsLog.find(e =>
        (tenant.id && String(e.tenantId) === String(tenant.id)) ||
        (!tenant.id && e.tenantName && e.tenantName === tenant.name));
      const monthLog = commsLog.filter(e => String(e.propertyId) === String(p.id) && e.month === monthKey);
      return { property: p, terms, due, paid, balance: Math.max(due - paid, 0), status, dueDate, daysPast, phase, suggested, tenants, records, lastContact, monthLog };
    }).sort((a, b) => {
      const rank = { unpaid: 0, partial: 1, paid: 2 };
      return rank[a.status] - rank[b.status] || b.daysPast - a.daysPast;
    });
  }, [properties, rentPayments, commsLog, settings, monthKey, today]);

  const totals = useMemo(() => ({
    due: rows.reduce((s, r) => s + r.due, 0),
    collected: rows.reduce((s, r) => s + Math.min(r.paid, r.due), 0),
    outstanding: rows.reduce((s, r) => s + r.balance, 0),
    late: rows.filter(r => r.status !== 'paid' && r.phase === 'late').length,
  }), [rows]);

  const openSettings = () => {
    setSettingsDraft({
      payInstructions: settings.payInstructions || '',
      fromName: settings.fromName || currentUser || '',
      dueDay: settings.dueDay || 1,
      graceDays: settings.graceDays ?? 5,
      lateFee: settings.lateFee || '',
    });
    setShowSettings(true);
  };

  const statusStyle = {
    paid: 'bg-green-500/10 border-green-500/20',
    partial: 'bg-yellow-500/10 border-yellow-500/20',
    unpaid: '',
  };
  const unpaidStyle = (phase) => phase === 'late' ? 'bg-red-500/10 border-red-500/20'
    : phase === 'upcoming' ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-orange-500/10 border-orange-500/20';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">📣 Rent Day</h2>
          <p className="text-xs text-white/40">Who's paid, who to nudge, and what was said.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthKey(k => shiftMonth(k, -1))} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-white/70" /></button>
          <span className="text-sm font-semibold text-white min-w-[110px] text-center">{monthName(monthKey)} {monthKey.slice(0, 4)}</span>
          <button onClick={() => setMonthKey(k => shiftMonth(k, 1))} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronRight className="w-4 h-4 text-white/70" /></button>
          {canManage && (
            <button onClick={openSettings} title="Payment instructions & defaults" className="w-8 h-8 ml-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><Settings className="w-4 h-4 text-white/70" /></button>
          )}
        </div>
      </div>

      {!settings.payInstructions && canManage && (
        <button onClick={openSettings} className="w-full text-left mb-4 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-sm text-orange-200 hover:bg-orange-500/15 transition">
          ⚙️ Set your Zelle / payment instructions once and every reminder includes them.
        </button>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Due this month</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totals.due)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Collected</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totals.collected)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Outstanding</p>
          <p className={`text-xl font-bold ${totals.outstanding > 0 ? 'text-yellow-400' : 'text-white/60'}`}>{formatCurrency(totals.outstanding)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Late</p>
          <p className={`text-xl font-bold ${totals.late > 0 ? 'text-red-400' : 'text-white/60'}`}>{totals.late}</p>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="p-6 text-center text-white/40 text-sm bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          No occupied properties with a monthly rent set.
        </div>
      )}

      {/* Property rows */}
      <div className="space-y-3">
        {rows.map(r => {
          const p = r.property;
          const isOpen = !!expanded[p.id];
          const cls = r.status === 'unpaid' ? unpaidStyle(r.phase) : statusStyle[r.status];
          const badge = r.status === 'paid' ? { t: 'Paid', c: 'text-green-400' }
            : r.status === 'partial' ? { t: `Partial · ${formatCurrency(r.balance)} left`, c: 'text-yellow-400' }
            : r.phase === 'late' ? { t: `${r.daysPast}d late`, c: 'text-red-400' }
            : r.phase === 'grace' ? { t: `Due ${formatDate(r.dueDate).replace(/, \d{4}$/, '')} · grace`, c: 'text-orange-300' }
            : r.phase === 'due' ? { t: 'Due today', c: 'text-orange-300' }
            : { t: `Due ${formatDate(r.dueDate).replace(/, \d{4}$/, '')}`, c: 'text-white/50' };
          return (
            <div key={p.id} className={`rounded-2xl border p-3 ${cls}`}>
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))} className="flex items-center gap-2 min-w-0 text-left">
                  <span className="text-lg flex-shrink-0">{p.emoji || '🏠'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    <p className={`text-xs ${badge.c}`}>{badge.t}{r.terms.lateFee > 0 && r.phase === 'late' && r.status !== 'paid' ? ` · +${formatCurrency(r.terms.lateFee)} fee` : ''}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-white">{formatCurrency(r.due)}</span>
                  {canManage && r.status !== 'paid' && (
                    <button onClick={() => onRecord({
                      incomeType: 'rent', propertyId: p.id, month: monthKey,
                      amount: r.status === 'partial' ? r.balance : r.due, status: 'paid',
                    })} className="px-3 py-1 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-semibold transition">
                      Record
                    </button>
                  )}
                  {r.status === 'paid' && <Check className="w-4 h-4 text-green-400" />}
                </div>
              </div>

              {/* Tenants */}
              <div className="mt-2 space-y-1.5">
                {r.tenants.length === 0 && <p className="text-xs text-white/30 pl-1">No tenant on file — add one under Tenants.</p>}
                {r.tenants.map(t => {
                  const last = r.lastContact(t);
                  const Icon = last ? (CHANNEL_ICON[last.channel] || StickyNote) : null;
                  return (
                    <div key={t.id || t.name} className="flex items-center justify-between gap-2 bg-black/20 rounded-xl px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs text-white/80 truncate">{t.name}{t.preferredPayment ? <span className="text-white/30"> · {t.preferredPayment}</span> : ''}</p>
                        <p className="text-[11px] text-white/30 truncate flex items-center gap-1">
                          {last ? <><Icon className="w-3 h-3" /> {timeAgo(last.at)} · {last.by}{last.template && last.template !== 'custom' ? ` · ${last.template}` : ''}</> : 'no contact logged'}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => onCompose({ property: p, tenant: t, monthKey, templateId: r.suggested, amountDue: r.due, balance: r.balance })}
                            disabled={!t.phone || t.smsOk === false}
                            title={!t.phone ? 'No phone' : t.smsOk === false ? 'Opted out of texts' : 'Text'}
                            className="w-8 h-8 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 disabled:opacity-30 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-teal-300" />
                          </button>
                          <button
                            onClick={() => onCompose({ property: p, tenant: t, monthKey, templateId: r.suggested, amountDue: r.due, balance: r.balance, channel: 'email' })}
                            disabled={!t.email} title={t.email ? 'Email' : 'No email'}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-white/70" />
                          </button>
                          <button
                            onClick={() => onCompose({ property: p, tenant: t, monthKey, templateId: r.suggested, amountDue: r.due, balance: r.balance, channel: 'note' })}
                            title="Log a call or note"
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
                            <StickyNote className="w-4 h-4 text-white/70" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Expanded: this month's payments + messages */}
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-white/10 text-xs space-y-1.5">
                  <p className="text-white/40 uppercase tracking-wide text-[10px]">Payments · {monthName(monthKey)}</p>
                  {r.records.length === 0 && <p className="text-white/30">None recorded.</p>}
                  {r.records.map(rec => (
                    <p key={rec.id} className="text-white/70">
                      {formatCurrency(rec.amount)} · {rec.status}{rec.method ? ` · ${rec.method}` : ''}{rec.datePaid ? ` · ${formatDate(rec.datePaid)}` : ''}{rec.source ? ' · 🔁' : ''}
                    </p>
                  ))}
                  <p className="text-white/40 uppercase tracking-wide text-[10px] pt-2">Contact · {monthName(monthKey)}</p>
                  {r.monthLog.length === 0 && <p className="text-white/30">Nothing logged.</p>}
                  {r.monthLog.map(e => {
                    const Icon = CHANNEL_ICON[e.channel] || StickyNote;
                    return (
                      <div key={e.id} className="flex gap-2 text-white/70">
                        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/40" />
                        <div className="min-w-0">
                          <span className="text-white/40">{formatDate(e.at.slice(0, 10))} · {e.by} → {e.tenantName}</span>
                          <p className="text-white/70 whitespace-pre-wrap break-words">{e.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-white/25 pt-2">Lease terms: due day {r.terms.dueDay} · {r.terms.graceDays}-day grace · late fee {formatCurrency(r.terms.lateFee)} (edit on the tenant)</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent activity across all tenants */}
      {commsLog.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-2">Recent messages</h3>
          <div className="space-y-1.5">
            {commsLog.slice(0, 15).map(e => {
              const Icon = CHANNEL_ICON[e.channel] || StickyNote;
              return (
                <div key={e.id} className="flex gap-2 text-xs bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/40" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white/40">{timeAgo(e.at)} · {e.by} → <span className="text-white/70">{e.tenantName}</span> · {e.propertyName}{e.month ? ` · ${monthName(e.month)}` : ''}</p>
                    <p className="text-white/60 truncate">{e.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && settingsDraft && (
        <div className="fixed inset-0 z-[210] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-md bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-1">Reminder settings</h2>
            <p className="text-xs text-white/40 mb-4">Shared by everyone who sends reminders.</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Payment instructions (added to every reminder)</label>
                <textarea rows={3} value={settingsDraft.payInstructions}
                  onChange={e => setSettingsDraft(d => ({ ...d, payInstructions: e.target.value }))}
                  placeholder='e.g. "Please pay by Zelle to 336-555-1234 (Rainbow Rentals)."'
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Sign messages as</label>
                <input value={settingsDraft.fromName} onChange={e => setSettingsDraft(d => ({ ...d, fromName: e.target.value }))}
                  placeholder="Mike" className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Default due day</label>
                  <input type="number" min="1" max="28" value={settingsDraft.dueDay} onChange={e => setSettingsDraft(d => ({ ...d, dueDay: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Grace days</label>
                  <input type="number" min="0" max="28" value={settingsDraft.graceDays} onChange={e => setSettingsDraft(d => ({ ...d, graceDays: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Late fee $</label>
                  <input type="number" step="0.01" value={settingsDraft.lateFee} onChange={e => setSettingsDraft(d => ({ ...d, lateFee: e.target.value }))}
                    placeholder="0" className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50" />
                </div>
              </div>
              <p className="text-[11px] text-white/30">Per-tenant values (on the tenant form) override these defaults.</p>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { onSaveSettings({
                payInstructions: settingsDraft.payInstructions.trim(),
                fromName: settingsDraft.fromName.trim(),
                dueDay: Math.min(Math.max(parseInt(settingsDraft.dueDay, 10) || 1, 1), 28),
                graceDays: Math.max(parseInt(settingsDraft.graceDays, 10) || 0, 0),
                lateFee: parseFloat(settingsDraft.lateFee) || 0,
              }); setShowSettings(false); }}
                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition">Save</button>
              <button onClick={() => setShowSettings(false)} className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
