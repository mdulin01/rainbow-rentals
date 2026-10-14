// Twilio outbound + webhook signature check.
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_MESSAGING_SERVICE_SID
// (preferred once A2P registration is done) or TWILIO_FROM (+1336…).
import twilio from 'twilio';

export const twilioReady = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
     && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM));

export function client() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function sendSms({ to, body, statusCallback }) {
  const params = { to, body };
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  else params.from = process.env.TWILIO_FROM;
  if (statusCallback) params.statusCallback = statusCallback;
  const msg = await client().messages.create(params);
  return { sid: msg.sid, status: msg.status };
}

/** Validate X-Twilio-Signature on a webhook. `params` = parsed form body. */
export function validWebhook(req, params) {
  const sig = req.headers['x-twilio-signature'];
  const url = publicUrl(req);
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN || '', sig || '', url, params || {});
}

/** The URL Twilio signed — Vercel sits behind a proxy, so rebuild it from forwarded headers. */
export function publicUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return `${proto}://${host}${req.url}`;
}

/** Parse an application/x-www-form-urlencoded body (Twilio webhooks). */
export function formBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  return Object.fromEntries(new URLSearchParams(raw));
}
