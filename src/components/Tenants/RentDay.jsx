import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Mail, Settings, Phone, StickyNote, Check } from 'lucide-react';
import { formatCurrency, formatDate, monthName, currentMonthKey, todayLocalStr, timeAgo } from '../../utils';
import { computeRentRows, unpaidPriorMonths, getPropertyTenants, shiftMonthKey } from '../../rentLogic.js';

const CHANNEL_ICON = { sms: MessageSquare, email: Mail, call: Phone, note: StickyNote };

/**
 * RentDay — one screen for the monthly collection loop: who's paid, who hasn't, and
 * one-tap Text / Email / Record per tenant, with the contact history right there.
 */
export default function RentDay({
  properties, rentPayments, commsLog = [], settings = {}, currentUser,
  onSaveSettings, onCompose, onRecord, onPatchLog, onSendSms, onEnableAlerts, pushState, incomeActuals, canManage,
}) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [testState, setTestState] = useState(null); // null | 'sending' | 'sent' | error string
  const [expanded, setExpanded] = useState({});
  const today = todayLocalStr();

  const rows = useMemo(() => computeRentRows({ properties, rentPayments, commsLog, settings, monthKey, today })
    .map(r => ({ ...r, monthKey })), [properties, rentPayments, commsLog, settings, monthKey, today]);

  const prior = useMemo(() => monthKey === currentMonthKey()
    ? unpaidPriorMonths({ properties, rentPayments, monthKey }) : [], [properties, rentPayments, monthKey]);

  const totals = useMemo(() => ({
    due: rows.reduce((s, r) => s + r.due, 0),
    collected: rows.reduce((s, r) => s + Math.min(r.paid, r.due), 0),
    outstanding: rows.reduce((s, r) => s + r.balance, 0),
    late: rows.filter(r => r.status !== 'paid' && r.phase === 'late').length,
  }), [rows]);
  // Bank deposits for this month (written by the mikeslife bridge) vs what's recorded here.
  const deposited = incomeActuals?.months?.[monthKey]?.total;
  const recordedAll = rows.reduce((s, r) => s + r.paid, 0);

  const openSettings = () => {
    const a = settings.auto || {};
    setSettingsDraft({
      payInstructions: settings.payInstructions || '',
      fromName: settings.fromName || currentUser || '',
      dueDay: settings.dueDay || 1,
      graceDays: settings.graceDays ?? 5,
      lateFee: settings.lateFee || '',
      useTwilio: !!settings.useTwilio,
      autoEnabled: !!a.enabled,
      daysBefore: a.daysBefore ?? 3,
      onDueDay: a.onDueDay !== false,
      afterGraceDays: a.afterGraceDays ?? 1,
      repeatEveryDays: a.repeatEveryDays ?? 7,
    });
    setShowSettings(true);
  };

  const inbound = useMemo(() => commsLog.filter(e => e.direction === 'in'), [commsLog]);
  const unreadCount = inbound.filter(e => e.unread).length;
  const findRowForEntry = (e) => rows.find(r => String(r.property.id) === String(e.propertyId));
  const tenantForEntry = (e) => {
    const r = findRowForEntry(e);
    return r?.tenants.find(t => String(t.id) === String(e.tenantId)) || { id: e.tenantId, name: e.tenantName, phone: e.from, firstName: (e.tenantName || '').split(' ')[0] };
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
          <button onClick={() => setMonthKey(k => shiftMonthKey(k, -1))} aria-label="Previous month" title="Previous month" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-white/70" /></button>
          <span className="text-sm font-semibold text-white min-w-[110px] text-center">{monthName(monthKey)} {monthKey.slice(0, 4)}</span>
          <button onClick={() => setMonthKey(k => shiftMonthKey(k, 1))} aria-label="Next month" title="Next month" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronRight className="w-4 h-4 text-white/70" /></button>
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

      {/* Replies from tenants (Twilio inbound) */}
      {inbound.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-2">
            💬 Replies{unreadCount > 0 ? ` (${unreadCount} new)` : ''}
          </h3>
          <div className="space-y-2">
            {inbound.slice(0, unreadCount > 0 ? 20 : 3).map(e => {
              const r = findRowForEntry(e);
              const t = tenantForEntry(e);
              const ai = e.ai || null;
              return (
                <div key={e.id} className={`rounded-2xl border p-3 ${e.unread ? 'bg-teal-500/10 border-teal-500/25' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-white/40">{timeAgo(e.at)} · <span className="text-white/80 font-medium">{e.tenantName}</span>{e.propertyName ? ` · ${e.propertyName}` : ''}{e.repliedAt ? ' · replied' : ''}</p>
                      <p className="text-sm text-white mt-0.5 whitespace-pre-wrap break-words">“{e.text}”</p>
                      {e.media?.length > 0 && <p className="text-[11px] text-white/40 mt-0.5">📎 {e.media.length} attachment{e.media.length > 1 ? 's' : ''} (open in Twilio console)</p>}
                      {ai && (
                        <div className="mt-2 text-xs rounded-xl bg-black/20 px-2.5 py-2">
                          <p className="text-white/60"><span className="text-teal-300 font-semibold">🦚 {ai.intent}</span>{ai.promisedDate ? ` · promises ${formatDate(ai.promisedDate)}` : ''} — {ai.summary}</p>
                          {ai.reply && <p className="text-white/50 mt-1 italic">Suggested: “{ai.reply}”</p>}
                        </div>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button onClick={() => onCompose({ property: r?.property || { id: e.propertyId, name: e.propertyName }, tenant: t, monthKey: e.month || monthKey, templateId: 'custom', channel: 'sms', text: ai?.reply || '', replyTo: e.id, replyToText: e.text, amountDue: r?.due, balance: r?.balance })}
                        className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-semibold transition">↩︎ Reply</button>
                      {ai?.intent === 'paid' && r && r.status !== 'paid' && (
                        <button onClick={() => onRecord({ incomeType: 'rent', propertyId: r.property.id, month: r.monthKey, amount: r.status === 'partial' ? r.balance : r.due, status: 'paid' })}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-semibold transition">Record payment</button>
                      )}
                      {e.unread && onPatchLog && (
                        <button onClick={() => onPatchLog(e.id, { unread: false })} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 text-xs transition">Done</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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

      {typeof deposited === 'number' && (
        <div className={`mb-4 rounded-2xl border px-4 py-2.5 flex items-center justify-between text-sm ${Math.abs(deposited - recordedAll) < 1 ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-amber-400/40 bg-amber-500/10'}`}>
          <span className="text-white/70">Bank: recorded <b className="text-white">{formatCurrency(recordedAll)}</b> · deposited <b className="text-white">{formatCurrency(deposited)}</b></span>
          <span className={`font-bold ${Math.abs(deposited - recordedAll) < 1 ? 'text-emerald-400' : 'text-amber-300'}`}>
            {Math.abs(deposited - recordedAll) < 1 ? 'matched ✓' : `${deposited - recordedAll > 0 ? '+' : ''}${formatCurrency(deposited - recordedAll)}`}
          </span>
        </div>
      )}

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

      {/* Earlier months still owed */}
      {prior.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-red-400/80 uppercase tracking-wide mb-2">Still owed from earlier months ({prior.length})</h3>
          <div className="space-y-2">
            {prior.map(({ property: p, monthKey: mk, due }) => {
              const t = getPropertyTenants(p).find(x => x.phone && x.smsOk !== false && x.status !== 'vacant');
              return (
                <div key={`${p.id}-${mk}`} className="flex items-center justify-between gap-2 rounded-2xl border bg-red-500/10 border-red-500/20 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{p.emoji || '🏠'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      <p className="text-xs text-red-300">{monthName(mk)} · not recorded</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold text-white">{formatCurrency(due)}</span>
                    {canManage && t && (
                      <button onClick={() => onCompose({ property: p, tenant: t, monthKey: mk, templateId: 'late', amountDue: due, balance: due })}
                        className="w-8 h-8 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 flex items-center justify-center" title={`Text ${t.name}`}>
                        <MessageSquare className="w-4 h-4 text-teal-300" />
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => onRecord({ incomeType: 'rent', propertyId: p.id, month: mk, amount: due, status: 'paid' })}
                        className="px-3 py-1 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-semibold transition">Record</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-white/30 mt-2">If a month was actually paid, record it (any amount, even $0 for a vacant month) and it drops off this list.</p>
        </div>
      )}

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
                    <p className="text-white/40">{timeAgo(e.at)} · {e.direction === 'in' ? <span className="text-white/70">{e.tenantName}</span> : <>{e.by}{e.auto ? ' ⏰' : ''} → <span className="text-white/70">{e.tenantName}</span></>} · {e.propertyName}{e.month ? ` · ${monthName(e.month)}` : ''}{e.delivery === 'failed' || e.delivery === 'undelivered' ? <span className="text-red-400"> · {e.delivery}</span> : e.delivery === 'delivered' ? <span className="text-green-400/70"> · ✓</span> : ''}</p>
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

              {onEnableAlerts && (
                <div className="pt-3 border-t border-white/10">
                  {pushState === 'granted' ? (
                    <p className="text-sm text-emerald-300">🔔 Alerts are on for this device.</p>
                  ) : (
                    <button onClick={onEnableAlerts} className="w-full px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-sm font-semibold hover:bg-amber-500/25">
                      🔔 Enable alerts on this device
                    </button>
                  )}
                  <p className="text-[11px] text-white/30 mt-1">A push when a tenant texts back and when scheduled reminders go out. On iPhone, open the app from the home screen first.</p>
                </div>
              )}

              <div className="pt-3 border-t border-white/10 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settingsDraft.useTwilio} onChange={e => setSettingsDraft(d => ({ ...d, useTwilio: e.target.checked }))} className="w-5 h-5 rounded accent-emerald-500" />
                  <span className="text-sm text-white">Send texts through Twilio <span className="text-white/40">(server number; replies land here)</span></span>
                </label>
                {settingsDraft.useTwilio && onSendSms && (
                  <div className="pl-8">
                    <label className="text-xs text-white/40 mb-1 block">Send a test text to</label>
                    <div className="flex gap-2">
                      <input value={testTo} onChange={e => { setTestTo(e.target.value); setTestState(null); }} placeholder="(704) 641-2157"
                        className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50" />
                      <button disabled={!testTo.trim() || testState === 'sending'}
                        onClick={async () => {
                          setTestState('sending');
                          try {
                            await onSendSms({ to: testTo, body: `Test from Rainbow Rentals: this is the number rent reminders will come from. Reply YES to confirm replies work. – ${settingsDraft.fromName || currentUser || 'Mike'}`, tenantName: 'Test', template: 'test' });
                            setTestState('sent');
                          } catch (e) { setTestState(e.message || 'failed'); }
                        }}
                        className="px-3 py-2 bg-teal-500/20 hover:bg-teal-500/30 disabled:opacity-40 text-teal-300 rounded-xl text-xs font-semibold transition">
                        {testState === 'sending' ? 'Sending…' : 'Send test'}
                      </button>
                    </div>
                    {testState === 'sent' && <p className="text-[11px] text-emerald-300 mt-1">Sent. Delivery status shows under Recent messages in a few seconds; a reply will land under 💬 Replies.</p>}
                    {testState && testState !== 'sent' && testState !== 'sending' && <p className="text-[11px] text-red-300 mt-1">{testState}</p>}
                  </div>
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settingsDraft.autoEnabled} disabled={!settingsDraft.useTwilio} onChange={e => setSettingsDraft(d => ({ ...d, autoEnabled: e.target.checked }))} className="w-5 h-5 rounded accent-emerald-500 disabled:opacity-40" />
                  <span className={`text-sm ${settingsDraft.useTwilio ? 'text-white' : 'text-white/40'}`}>Automatic reminders <span className="text-white/40">(daily at 10am ET)</span></span>
                </label>
                {settingsDraft.autoEnabled && settingsDraft.useTwilio && (
                  <div className="grid grid-cols-2 gap-3 pl-8">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Days before due</label>
                      <input type="number" min="0" max="14" value={settingsDraft.daysBefore} onChange={e => setSettingsDraft(d => ({ ...d, daysBefore: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer mt-5">
                      <input type="checkbox" checked={settingsDraft.onDueDay} onChange={e => setSettingsDraft(d => ({ ...d, onDueDay: e.target.checked }))} className="w-4 h-4 rounded accent-emerald-500" />
                      <span className="text-xs text-white/70">On the due day</span>
                    </label>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Days after grace ends</label>
                      <input type="number" min="0" max="14" value={settingsDraft.afterGraceDays} onChange={e => setSettingsDraft(d => ({ ...d, afterGraceDays: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Then repeat every (days)</label>
                      <input type="number" min="0" max="30" value={settingsDraft.repeatEveryDays} onChange={e => setSettingsDraft(d => ({ ...d, repeatEveryDays: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50" />
                    </div>
                    <p className="col-span-2 text-[11px] text-white/30">Only tenants marked “OK to text”. Nothing is sent twice for the same month and step. Paid properties are skipped.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { onSaveSettings({
                payInstructions: settingsDraft.payInstructions.trim(),
                fromName: settingsDraft.fromName.trim(),
                dueDay: Math.min(Math.max(parseInt(settingsDraft.dueDay, 10) || 1, 1), 28),
                graceDays: Math.max(parseInt(settingsDraft.graceDays, 10) || 0, 0),
                lateFee: parseFloat(settingsDraft.lateFee) || 0,
                useTwilio: !!settingsDraft.useTwilio,
                auto: {
                  enabled: !!settingsDraft.autoEnabled && !!settingsDraft.useTwilio,
                  daysBefore: Math.max(parseInt(settingsDraft.daysBefore, 10) || 0, 0),
                  onDueDay: !!settingsDraft.onDueDay,
                  afterGraceDays: Math.max(parseInt(settingsDraft.afterGraceDays, 10) || 0, 0),
                  repeatEveryDays: Math.max(parseInt(settingsDraft.repeatEveryDays, 10) || 0, 0),
                },
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
