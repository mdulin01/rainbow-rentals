// POST /api/sms/inbound — Twilio "A message comes in" webhook.
// Logs the reply under the matching tenant, lets Claude triage it (summary + suggested
// reply, never auto-sent), handles STOP/START, and pushes a notification to the managers.
import { validWebhook, formBody } from '../_lib/twilio.js';
import { loadAll, appendCommsLog, setTenantSmsOk, pushManagers } from '../_lib/data.js';
import { triageInbound } from '../_lib/triage.js';
import { findTenantByPhone, computeRentRows } from '../../src/rentLogic.js';
import { currentMonthKey, todayLocalStr, normalizePhone } from '../../src/utils.js';

const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'revoke', 'optout'];
const START_WORDS = ['start', 'yes', 'unstop'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const params = formBody(req);
  if (!validWebhook(req, params)) return res.status(403).end('bad signature');

  const from = normalizePhone(params.From);
  const text = String(params.Body || '').trim();
  const numMedia = parseInt(params.NumMedia || '0', 10) || 0;
  const media = [];
  for (let i = 0; i < numMedia; i++) if (params[`MediaUrl${i}`]) media.push(params[`MediaUrl${i}`]);

  try {
    const { properties, rentPayments, settings, commsLog } = await loadAll();
    const match = findTenantByPhone(properties, from);
    const monthKey = currentMonthKey();
    const rows = computeRentRows({ properties, rentPayments, commsLog, settings, monthKey, today: todayLocalStr() });
    const row = match ? rows.find(r => String(r.property.id) === String(match.property.id)) : null;
    if (row) row.monthKey = monthKey;

    const lower = text.toLowerCase();
    // Advanced Opt-Out reports the action after matching configured keywords.
    const optOutType = String(params.OptOutType || '').toUpperCase();
    const isStop = optOutType === 'STOP' || (!optOutType && STOP_WORDS.includes(lower));
    const isStart = optOutType === 'START' || (!optOutType && START_WORDS.includes(lower));

    const entry = {
      id: `in-${Date.now()}`, at: new Date().toISOString(), by: match ? match.tenant.name : from,
      direction: 'in', channel: 'sms', via: 'twilio', sid: params.MessageSid || null, from,
      propertyId: match ? match.property.id : null, propertyName: match ? match.property.name : '',
      tenantId: match ? match.tenant.id : null, tenantName: match ? match.tenant.name : `Unknown ${from}`,
      month: monthKey, text: text || (media.length ? '(photo)' : ''), media, unread: true,
    };

    if (match && (isStop || isStart)) {
      await setTenantSmsOk(match.property.id, match.tenant.id, isStart);
      entry.ai = { intent: isStop ? 'stop' : 'start', summary: isStop ? 'Tenant opted out of texts (STOP).' : 'Tenant opted back in (START).', reply: '', needsHuman: false };
    } else if (text) {
      entry.ai = await triageInbound({ text, tenant: match?.tenant, property: match?.property, row, settings, from: settings.fromName });
    }

    await appendCommsLog([entry]);
    const who = match ? `${match.tenant.name} (${match.property.name})` : from;
    await pushManagers({
      title: `💬 ${who}`,
      body: entry.ai?.summary ? `${entry.ai.summary} — "${text.slice(0, 80)}"` : text.slice(0, 120) || 'sent a photo',
    });
  } catch (e) {
    console.error('inbound failed', e);
  }
  // Empty TwiML: Twilio's own Advanced Opt-Out answers STOP/START; we never auto-reply here.
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}
