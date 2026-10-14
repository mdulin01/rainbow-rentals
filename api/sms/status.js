// POST /api/sms/status?id=msg-…  — Twilio delivery status callback (queued → sent → delivered / failed).
import { validWebhook, formBody } from '../_lib/twilio.js';
import { patchCommsEntry } from '../_lib/data.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const params = formBody(req);
  if (!validWebhook(req, params)) return res.status(403).end('bad signature');
  const id = (req.query && req.query.id) || new URL(req.url, 'http://x').searchParams.get('id');
  const patch = { delivery: params.MessageStatus || params.SmsStatus || 'unknown' };
  if (params.ErrorCode) patch.deliveryError = `${params.ErrorCode} ${params.ErrorMessage || ''}`.trim();
  if (id) { try { await patchCommsEntry(id, patch); } catch (e) { console.error('status patch', e); } }
  res.status(204).end();
}
