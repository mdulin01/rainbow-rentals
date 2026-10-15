// GET /api/cron/reminders — daily (vercel.json crons). Sends the scheduled rent reminders
// (before due, on due day, after grace, then every N days) to tenants who can be texted,
// skipping anything already sent for that tenant/month/kind. Enable + tune under Rent Day ⚙️.
// Also writes the weekly Firestore snapshot (rentalData/backup-YYYY-MM-DD) whether or not
// auto reminders are on.
// Auth: Vercel sets `Authorization: Bearer $CRON_SECRET` on cron invocations.
import { loadAll, appendCommsLog, pushManagers, weeklyBackup, ensurePortalToken } from '../_lib/data.js';
import { sendSms, twilioReady, publicUrl } from '../_lib/twilio.js';
import { computeAutoRows, dueAutoReminders, reminderVars, renderReminder } from '../../src/rentLogic.js';
import { currentMonthKey, todayLocalStr, normalizePhone } from '../../src/utils.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });
  const dryRun = req.query?.dry === '1';

  let backup;
  try { backup = dryRun ? 'skipped (dry run)' : await weeklyBackup(); } catch (e) { console.error('cron/backup', e); backup = `failed: ${e.message}`; }

  try {
    const { properties, rentPayments, settings, commsLog } = await loadAll();
    const auto = settings.auto || {};
    if (!auto.enabled) return res.status(200).json({ ok: true, backup, skipped: 'auto reminders disabled' });
    if (!twilioReady() && !dryRun) return res.status(503).json({ error: 'Twilio not configured' });

    const monthKey = currentMonthKey();
    const today = todayLocalStr();
    const rows = computeAutoRows({ properties, rentPayments, commsLog, settings, monthKey, today });
    const due = dueAutoReminders({ rows, commsLog, auto, today });
    const origin = publicUrl(req).replace(/\/api\/.*$/, '');
    const sent = [], failed = [];

    for (const { row, tenant, kind, templateId } of due) {
      let portalUrl = '';
      if (!dryRun) { try { portalUrl = `${origin}/t/${await ensurePortalToken(row.property, tenant)}`; } catch (e) { console.error('portal token', e); } }
      const vars = reminderVars({ property: row.property, tenant, monthKey: row.monthKey, terms: row.terms, settings, amountDue: row.due, balance: row.balance, portalUrl });
      const body = renderReminder(templateId, vars);
      const to = normalizePhone(tenant.phone);
      const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry = {
        id, at: new Date().toISOString(), by: 'auto', auto: kind, via: 'twilio', direction: 'out', channel: 'sms', to,
        propertyId: row.property.id, propertyName: row.property.name, tenantId: tenant.id, tenantName: tenant.name,
        month: row.monthKey, template: templateId, text: body,
      };
      if (dryRun) { sent.push({ ...entry, dryRun: true }); continue; }
      try {
        const r = await sendSms({ to, body, statusCallback: `${origin}/api/sms/status?id=${id}` });
        entry.sid = r.sid; entry.delivery = r.status;
        sent.push(entry);
      } catch (e) {
        failed.push({ tenant: tenant.name, error: e.message });
        entry.delivery = 'failed'; entry.deliveryError = e.message;
        sent.push(entry); // log the failure too so it isn't retried every day
      }
    }
    if (!dryRun && sent.length) {
      await appendCommsLog(sent);
      await pushManagers({ title: '📣 Rent reminders sent', body: sent.map(s => `${s.tenantName} (${s.auto})`).join(', ').slice(0, 200) });
    }
    return res.status(200).json({ ok: true, backup, today, monthKey, considered: rows.length, sent: sent.map(s => ({ to: s.tenantName, kind: s.auto, delivery: s.delivery, text: s.text })), failed });
  } catch (e) {
    console.error('cron/reminders', e);
    return res.status(500).json({ error: e.message });
  }
}
