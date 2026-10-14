// POST /api/sms/send  { to, body, tenantId, tenantName, propertyId, propertyName, month, template, replyTo }
// Auth: Firebase ID token of a manager. Sends through Twilio and logs to rentalData/comms.
import { requireManager } from '../_lib/firebase.js';
import { appendCommsLog, patchCommsEntry } from '../_lib/data.js';
import { sendSms, twilioReady, publicUrl } from '../_lib/twilio.js';
import { normalizePhone } from '../../src/utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const who = await requireManager(req);
    if (!twilioReady()) return res.status(503).json({ error: 'Twilio is not configured on the server' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const to = normalizePhone(b.to);
    const body = String(b.body || '').trim();
    if (!to || !body) return res.status(400).json({ error: 'to and body are required' });
    if (body.length > 1200) return res.status(400).json({ error: 'message too long' });

    const id = `msg-${Date.now()}`;
    const origin = publicUrl(req).replace(/\/api\/.*$/, '');
    const r = await sendSms({ to, body, statusCallback: `${origin}/api/sms/status?id=${id}` });
    const entry = {
      id, at: new Date().toISOString(), by: who.name, via: 'twilio', sid: r.sid, delivery: r.status,
      direction: 'out', channel: 'sms', to,
      propertyId: b.propertyId ?? null, propertyName: b.propertyName || '',
      tenantId: b.tenantId ?? null, tenantName: b.tenantName || '',
      month: b.month || null, template: b.template || 'custom', text: body,
    };
    await appendCommsLog([entry]);
    if (b.replyTo) { try { await patchCommsEntry(b.replyTo, { repliedAt: entry.at, repliedBy: who.name }); } catch { /* best effort */ } }
    return res.status(200).json({ ok: true, id, sid: r.sid });
  } catch (e) {
    const status = e.status || (e.code === 21211 ? 400 : 500);
    console.error('sms/send', e);
    const twilioCode = e.code && e.moreInfo ? ` (Twilio ${e.code})` : '';
    return res.status(status).json({ error: (e.message || 'send failed') + twilioCode });
  }
}
