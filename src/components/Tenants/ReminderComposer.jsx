import React, { useState, useMemo } from 'react';
import { X, MessageSquare, Mail, Copy, Phone, StickyNote } from 'lucide-react';
import { reminderTemplates } from '../../constants';
import { buildSmsLink, buildMailtoLink, normalizePhone } from '../../utils';
import { getLeaseTerms, reminderVars, renderReminder } from '../../rentLogic.js';

/**
 * ReminderComposer — pick a template, tweak the text, then open Messages / Mail with it
 * pre-filled (no backend: the text goes out from the manager's own phone). Every send
 * is logged to rentalData/comms so both operators can see who was contacted and when.
 *
 * target: { property, tenant, monthKey, templateId, amountDue, balance }
 */
export default function ReminderComposer({ target, settings = {}, currentUser, onLog, onSendSms, onClose, showToast }) {
  const { property, tenant, monthKey } = target;
  const terms = useMemo(() => getLeaseTerms(property, settings), [property, settings]);
  const [templateId, setTemplateId] = useState(target.templateId || 'upcoming');
  const [noteDraft, setNoteDraft] = useState('');
  const [channel, setChannel] = useState(target.channel || 'sms'); // sms | email | call | note

  // Private balance/lease page for this tenant (token is created when the composer opens).
  const portalUrl = tenant?.portalToken && typeof window !== 'undefined' ? `${window.location.origin}/t/${tenant.portalToken}` : '';
  const vars = useMemo(() => reminderVars({
    property, tenant, monthKey, terms, settings, from: currentUser, portalUrl,
    amountDue: target.amountDue, balance: target.balance,
  }), [tenant, property, monthKey, terms, settings, currentUser, target.amountDue, target.balance, portalUrl]);

  const render = (id) => renderReminder(id, vars);
  const [text, setText] = useState(() => target.text || render(templateId));
  const [sending, setSending] = useState(false);
  const pickTemplate = (id) => { setTemplateId(id); setText(render(id)); };

  const phone = tenant?.phone || '';
  const email = tenant?.email || '';
  const canText = !!normalizePhone(phone) && tenant?.smsOk !== false;

  const log = (ch, body) => {
    onLog && onLog({
      id: `msg-${Date.now()}`,
      at: new Date().toISOString(),
      by: currentUser || 'unknown',
      propertyId: property?.id,
      propertyName: property?.name || '',
      tenantId: tenant?.id,
      tenantName: tenant?.name || '',
      channel: ch,
      template: templateId,
      month: monthKey,
      text: String(body || '').slice(0, 1000),
    });
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); showToast && showToast('Copied', 'success'); }
    catch { showToast && showToast('Copy failed — select the text and copy manually', 'error'); }
  };

  const handleLogOnly = () => {
    const body = channel === 'note' || channel === 'call' ? noteDraft.trim() : text;
    if (!body) return;
    log(channel, body);
    showToast && showToast(channel === 'call' ? 'Call logged' : 'Note saved', 'success');
    onClose();
  };

  const subject = `${vars.month} rent — ${vars.property}`;

  return (
    <div className="fixed inset-0 z-[210] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{tenant?.name || 'Tenant'}</h2>
            <p className="text-xs text-white/40 truncate">
              {property?.emoji || '🏠'} {property?.name} · {vars.month} · {vars.amount} due {vars.dueDate}
            </p>
            {target.replyToText && (
              <p className="text-xs text-teal-200/80 mt-1 bg-teal-500/10 border border-teal-500/20 rounded-lg px-2 py-1 line-clamp-3">↩︎ “{target.replyToText}”</p>
            )}
            <p className="text-xs text-white/30 mt-0.5">
              {phone ? `📱 ${phone}` : 'no phone on file'}{email ? ` · ✉️ ${email}` : ''}
              {tenant?.smsOk === false && <span className="text-orange-400 ml-2">texting declined</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 flex-shrink-0">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Channel */}
        <div className="flex gap-1.5 mb-3">
          {[
            { id: 'sms', label: 'Text', Icon: MessageSquare },
            { id: 'email', label: 'Email', Icon: Mail },
            { id: 'call', label: 'Log call', Icon: Phone },
            { id: 'note', label: 'Note', Icon: StickyNote },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setChannel(id)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-medium border transition ${
                channel === id ? 'bg-teal-500/20 border-teal-400/40 text-teal-300' : 'bg-white/[0.05] border-white/[0.08] text-white/50 hover:bg-white/10'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {(channel === 'sms' || channel === 'email') && (
          <>
            {/* Template chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {reminderTemplates.map(t => (
                <button key={t.id} onClick={() => pickTemplate(t.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition ${
                    templateId === t.id ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-white/[0.05] border-white/[0.08] text-white/50 hover:bg-white/10'
                  }`}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50 resize-y"
            />
            {!settings.payInstructions && (
              <p className="text-[11px] text-orange-300/80 mt-1">
                No payment instructions set — add your Zelle details under Rent Day ⚙️ so they're included automatically.
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              {channel === 'sms' && canText && settings.useTwilio && onSendSms && (
                <button disabled={sending || !text.trim()}
                  onClick={async () => {
                    setSending(true);
                    try {
                      await onSendSms({
                        to: phone, body: text, tenantId: tenant?.id, tenantName: tenant?.name,
                        propertyId: property?.id, propertyName: property?.name, month: monthKey,
                        template: templateId, replyTo: target.replyTo || null,
                      });
                      showToast && showToast('Text sent', 'success');
                      onClose();
                    } catch (e) {
                      showToast && showToast('Send failed — ' + (e.message || 'unknown error'), 'error');
                    } finally { setSending(false); }
                  }}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition">
                  <MessageSquare className="w-4 h-4" /> {sending ? 'Sending…' : 'Send text'}
                </button>
              )}
              {channel === 'sms' && (
                canText ? (
                  <a href={buildSmsLink(phone, text)} onClick={() => { log('sms', text); showToast && showToast('Logged — Messages should open', 'success'); setTimeout(onClose, 300); }}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${settings.useTwilio && onSendSms ? 'bg-white/10 hover:bg-white/20 text-white' : 'flex-1 min-w-[140px] bg-emerald-500 hover:bg-emerald-600 text-white'}`}>
                    <MessageSquare className="w-4 h-4" /> {settings.useTwilio && onSendSms ? 'My phone' : 'Open Messages'}
                  </a>
                ) : (
                  <div className="flex-1 min-w-[140px] px-4 py-2.5 bg-white/5 text-white/40 rounded-xl text-xs text-center">
                    {phone ? 'Tenant opted out of texts' : 'Add a phone number to text'}
                  </div>
                )
              )}
              {channel === 'email' && (
                email ? (
                  <a href={buildMailtoLink(email, subject, text)} onClick={() => { log('email', text); showToast && showToast('Logged — Mail should open', 'success'); setTimeout(onClose, 300); }}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition">
                    <Mail className="w-4 h-4" /> Open Mail
                  </a>
                ) : (
                  <div className="flex-1 min-w-[140px] px-4 py-2.5 bg-white/5 text-white/40 rounded-xl text-xs text-center">Add an email to send</div>
                )
              )}
              <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button onClick={() => { log(channel, text); showToast && showToast('Logged as sent', 'success'); onClose(); }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-xs transition" title="Already sent it another way? Just record it.">
                Log as sent
              </button>
            </div>
          </>
        )}

        {(channel === 'call' || channel === 'note') && (
          <>
            {channel === 'call' && phone && (
              <a href={`tel:${normalizePhone(phone)}`} className="inline-flex items-center gap-2 mb-3 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition">
                <Phone className="w-4 h-4" /> Call {phone}
              </a>
            )}
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              rows={4}
              placeholder={channel === 'call' ? 'What was said? e.g. "Says Zelle coming Friday"' : 'Note about this tenant / month…'}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 resize-y"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={handleLogOnly} disabled={!noteDraft.trim()}
                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition">
                Save
              </button>
              <button onClick={onClose} className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
