// GET /t/<token> (rewritten to /api/portal/<token>) — a tenant's private page: this month's
// rent and balance, earlier months owed, how to pay, lease terms, recent payments.
// No login: the token is a 128-bit secret minted per tenant and sent only to their phone.
// Read-only; nothing here is cached or indexed.
import { loadAll } from '../_lib/data.js';
import { findTenantByToken, tenantPortalData } from '../../src/rentLogic.js';
import { formatCurrency, formatDate, monthName, todayLocalStr } from '../../src/utils.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).end();

  const token = String(req.query?.token || '');
  if (!/^[a-f0-9]{24,64}$/.test(token)) return res.status(404).end(page('Link not found', '<p>This link isn’t valid. Reply to your last text from Rainbow Rentals and we’ll send a fresh one.</p>'));

  try {
    const { properties, rentPayments, settings } = await loadAll();
    const match = findTenantByToken(properties, token);
    if (!match) return res.status(404).end(page('Link not found', '<p>This link isn’t valid any more. Reply to your last text from Rainbow Rentals and we’ll send a fresh one.</p>'));
    const d = tenantPortalData({ properties, rentPayments, settings, property: match.property, tenant: match.tenant, today: todayLocalStr() });
    const contact = process.env.PORTAL_CONTACT_PHONE || process.env.TWILIO_FROM || '';
    return res.status(200).end(page(`${d.first} · ${d.property.name}`, renderPortal(d, contact)));
  } catch (e) {
    console.error('portal', e);
    return res.status(500).end(page('Something went wrong', '<p>We couldn’t load your details right now. Please try again in a few minutes.</p>'));
  }
}

export function renderPortal(d, contact) {
  const addr = [d.property.street, [d.property.city, d.property.state].filter(Boolean).join(', '), d.property.zip].filter(Boolean).join(' · ');
  const month = monthName(d.monthKey);
  const r = d.rent;
  let pill, pillClass = 'muted', note = '';
  if (!r) { pill = 'No rent due'; }
  else if (r.status === 'paid') { pill = 'Paid — thank you'; pillClass = 'good'; }
  else if (r.phase === 'late') { pill = `Past due · ${r.daysPast} day${r.daysPast === 1 ? '' : 's'}`; pillClass = 'bad'; note = d.terms.lateFee > 0 ? `A ${formatCurrency(d.terms.lateFee)} late fee applies after the ${d.terms.graceDays}-day grace period.` : ''; }
  else if (r.phase === 'grace') { pill = `Due ${formatDate(r.dueDate)} · in grace period`; pillClass = 'warn'; }
  else if (r.phase === 'due') { pill = 'Due today'; pillClass = 'warn'; }
  else { pill = `Due ${formatDate(r.dueDate)}`; }
  const priorTotal = d.priorOwed.reduce((s, x) => s + x.due, 0);
  const totalOwed = (r ? r.balance : 0) + priorTotal;

  const leaseLine = d.lease.kind === 'month-to-month'
    ? `Month-to-month${d.lease.end ? ` (original term ended ${formatDate(d.lease.end)})` : ''}`
    : d.lease.end ? `${formatDate(d.lease.end)}${d.lease.label ? ` · ${esc(d.lease.label)}` : ''}` : 'Not on file';

  return `
  <header>
    <div class="brand">🌈 Rainbow Rentals</div>
    <h1>Hi ${esc(d.first)}</h1>
    <div class="addr">${esc(d.property.name)}${addr ? ` · ${esc(addr)}` : ''}</div>
  </header>

  <section class="card">
    <div class="row"><h2>${esc(month)} rent</h2><span class="pill ${pillClass}">${esc(pill)}</span></div>
    ${r ? `
    <dl>
      <div><dt>Rent</dt><dd>${formatCurrency(r.due)}</dd></div>
      <div><dt>Paid so far</dt><dd>${formatCurrency(r.paid)}</dd></div>
      <div class="big"><dt>Balance</dt><dd class="${r.balance > 0 ? 'bad' : 'good'}">${formatCurrency(r.balance)}</dd></div>
    </dl>` : '<p class="muted">Nothing is due for this month.</p>'}
    ${note ? `<p class="note">${esc(note)}</p>` : ''}
    ${d.priorOwed.length ? `
    <div class="prior">
      <h3>Earlier months with no payment recorded</h3>
      <ul>${d.priorOwed.map(x => `<li><span>${esc(monthName(x.monthKey))}</span><b>${formatCurrency(x.due)}</b></li>`).join('')}</ul>
      <p class="muted small">If you already paid one of these, reply to our text and we’ll fix it.</p>
    </div>
    <div class="total"><span>Total owed</span><b class="bad">${formatCurrency(totalOwed)}</b></div>` : ''}
  </section>

  ${d.payInstructions ? `
  <section class="card">
    <h2>How to pay</h2>
    <p>${esc(d.payInstructions)}</p>
    <p class="muted small">Rent is due on the ${ordinal(d.terms.dueDay)} of each month${d.terms.graceDays ? `, with a ${d.terms.graceDays}-day grace period` : ''}${d.terms.lateFee > 0 ? `; a ${formatCurrency(d.terms.lateFee)} late fee applies after that` : ''}.</p>
  </section>` : ''}

  <section class="card">
    <h2>Your lease</h2>
    <dl class="stack">
      <div><dt>Monthly rent</dt><dd>${formatCurrency(d.lease.monthlyRent)}</dd></div>
      <div><dt>Lease start</dt><dd>${d.lease.start ? formatDate(d.lease.start) : 'Not on file'}</dd></div>
      <div><dt>Lease end</dt><dd>${leaseLine}</dd></div>
      <div><dt>Security deposit</dt><dd>${d.lease.deposit ? formatCurrency(d.lease.deposit) : 'Not on file'}</dd></div>
      <div><dt>Rent due</dt><dd>${ordinal(d.terms.dueDay)} of the month</dd></div>
    </dl>
  </section>

  ${d.payments.length ? `
  <section class="card">
    <h2>Recent payments</h2>
    <ul class="pay">${d.payments.map(p => `<li><span>${p.datePaid ? formatDate(p.datePaid) : '—'}</span><span class="muted">${esc(p.month ? monthName(p.month) + ' rent' : '')}${p.method ? ` · ${esc(p.method)}` : ''}</span><b>${formatCurrency(p.amount)}</b></li>`).join('')}</ul>
  </section>` : ''}

  <section class="card contact">
    <h2>Questions or a repair?</h2>
    <p>Reply to our text${contact ? ` or message <a href="sms:${esc(contact)}">${esc(prettyPhone(contact))}</a>` : ''}. For anything urgent (no heat, water leak, lockout) call or text right away.</p>
    <p class="muted small">${d.smsOk ? 'Reply STOP to stop text messages.' : 'You’ve opted out of texts; reply START to turn them back on.'}</p>
  </section>

  <footer>This page is private to you — please don’t share the link. Updated ${esc(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} ET · ${esc(d.fromName)}</footer>`;
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]}`;
const prettyPhone = (p) => { const d = String(p).replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };

export function page(title, inner) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Rainbow Rentals</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:#0f172a;color:#e2e8f0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:16px;max-width:560px;margin:0 auto}
  header{padding:8px 4px 16px}
  .brand{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8}
  h1{margin:4px 0 2px;font-size:26px}
  .addr{color:#94a3b8;font-size:14px}
  h2{margin:0;font-size:17px}
  h3{margin:12px 0 6px;font-size:14px;color:#cbd5e1}
  .card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:16px;margin-bottom:12px}
  .row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .pill{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.1);color:#cbd5e1}
  .pill.good{background:rgba(52,211,153,.15);color:#6ee7b7}
  .pill.warn{background:rgba(251,191,36,.15);color:#fcd34d}
  .pill.bad{background:rgba(248,113,113,.15);color:#fca5a5}
  dl{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:14px 0 0}
  dl.stack{grid-template-columns:1fr 1fr}
  dl div{background:rgba(255,255,255,.04);border-radius:12px;padding:10px 12px}
  dl div.big{grid-column:1/-1}
  dt{font-size:12px;color:#94a3b8}
  dd{margin:2px 0 0;font-size:20px;font-weight:700}
  dl.stack dd{font-size:15px}
  .good{color:#6ee7b7}.bad{color:#fca5a5}.muted{color:#94a3b8}.small{font-size:13px}
  .note{margin:12px 0 0;font-size:14px;color:#fcd34d}
  .prior ul,.pay{list-style:none;padding:0;margin:0}
  .prior li,.pay li{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid rgba(255,255,255,.08)}
  .pay li span:nth-child(2){flex:1;font-size:13px}
  .total{display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.15);font-size:17px}
  p{margin:10px 0 0}
  a{color:#5eead4}
  footer{color:#64748b;font-size:12px;text-align:center;padding:12px 8px 24px}
</style></head><body>${inner}</body></html>`;
}
