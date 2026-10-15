// rentLogic.js — pure, environment-free rent/reminder logic shared by the React app
// (Rent Day, composer, Action Items) and the Vercel API functions (daily reminder cron,
// inbound SMS). No React, no Firebase, no browser globals.
import { reminderTemplates } from './constants.js';
import { formatCurrency, formatDate, monthName, rentDueDateStr, fillTemplate, parseLocalDate, normalizePhone, todayLocalStr } from './utils.js';

/** Tenants array from a property, handling legacy single-tenant data. */
export const getPropertyTenants = (property) => {
  if (!property) return [];
  if (Array.isArray(property.tenants) && property.tenants.length > 0) return property.tenants;
  if (property.tenant && property.tenant.name) return [{ id: `legacy-${property.id}`, ...property.tenant }];
  return [];
};

/**
 * Lease terms for a property: rent due day, grace period, late fee. Stored on the
 * tenant (the lease); first active tenant with any set wins, else `defaults`
 * (rentalData/comms settings), else due 1st / 5-day grace / no fee.
 */
export const getLeaseTerms = (property, defaults = {}) => {
  const tenants = getPropertyTenants(property);
  const active = tenants.filter(t => !t.status || ['active', 'notice', 'pending'].includes(t.status));
  const src = [...active, ...tenants].find(t => t.rentDueDay || t.graceDays || t.lateFee) || {};
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  return {
    dueDay: Math.min(Math.max(parseInt(src.rentDueDay || defaults.dueDay || 1, 10) || 1, 1), 28),
    graceDays: Math.max(parseInt(src.graceDays ?? defaults.graceDays ?? 5, 10) || 0, 0),
    lateFee: num(src.lateFee, num(defaults.lateFee, 0)),
  };
};

/** Properties that owe rent this month (occupied with a rent amount). */
export const rentProperties = (properties) => properties.filter(p =>
  ['occupied', 'lease-expired', 'month-to-month'].includes(
    p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant')
  ) && (parseFloat(p.monthlyRent) || 0) > 0);

/**
 * One row per rent property for `monthKey`: paid/partial/unpaid, where we are relative
 * to the due date, and which reminder template fits. `today` is a local YYYY-MM-DD.
 */
export const computeRentRows = ({ properties, rentPayments, commsLog = [], settings = {}, monthKey, today }) =>
  rentProperties(properties).map(p => {
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

/** Placeholder values for a reminder to `tenant` about `property` for `monthKey`. */
export const reminderVars = ({ property, tenant, monthKey, terms, settings = {}, amountDue, balance, from, portalUrl }) => {
  const first = tenant?.firstName || (tenant?.name || '').trim().split(/\s+/)[0] || 'there';
  const due = amountDue ?? (parseFloat(property?.monthlyRent) || 0);
  const dueDate = rentDueDateStr(monthKey, terms.dueDay);
  const payInstructions = (settings.payInstructions || '').trim();
  return {
    first,
    amount: formatCurrency(due),
    balance: formatCurrency(balance ?? due),
    property: property?.name || 'the property',
    month: monthName(monthKey),
    dueDate: formatDate(dueDate).replace(/, \d{4}$/, ''),
    lateFeeLine: terms.lateFee > 0 ? `A ${formatCurrency(terms.lateFee)} late fee applies after the ${terms.graceDays}-day grace period. ` : '',
    payInstructions: payInstructions ? payInstructions + ' ' : '',
    portalLine: portalUrl ? `Balance & lease details: ${portalUrl} ` : '',
    from: settings.fromName || from || 'Rainbow Rentals',
  };
};

export const renderReminder = (templateId, vars) =>
  fillTemplate((reminderTemplates.find(x => x.id === templateId) || reminderTemplates[0]).text, vars);

/** Find the tenant (and property) whose private portal token matches. */
export const findTenantByToken = (properties, token) => {
  if (!token) return null;
  for (const p of properties) {
    for (const t of getPropertyTenants(p)) {
      if (t.portalToken && t.portalToken === token) return { property: p, tenant: t };
    }
  }
  return null;
};

/**
 * Everything the tenant-facing portal page shows, computed from the same rules the app
 * uses. Household-level money (the property's rent), this tenant's lease terms.
 */
export const tenantPortalData = ({ properties, rentPayments, settings = {}, property, tenant, today = todayLocalStr() }) => {
  const monthKey = today.slice(0, 7);
  const rows = computeRentRows({ properties, rentPayments, settings, monthKey, today });
  const row = rows.find(r => String(r.property.id) === String(property.id)) || null;
  const prior = unpaidPriorMonths({ properties, rentPayments, monthKey })
    .filter(x => String(x.property.id) === String(property.id));
  const terms = getLeaseTerms(property, settings);
  const payments = rentPayments
    .filter(r => String(r.propertyId) === String(property.id) && (!r.incomeType || r.incomeType === 'rent')
      && ['paid', 'partial', 'late'].includes(r.status))
    .sort((a, b) => (b.datePaid || b.month || '').localeCompare(a.datePaid || a.month || ''))
    .slice(0, 8)
    .map(r => ({ datePaid: r.datePaid || '', month: r.month || '', amount: parseFloat(r.amount) || 0, method: r.method || '' }));
  const lease = leaseState(tenant, today);
  return {
    monthKey,
    first: tenant.firstName || (tenant.name || '').trim().split(/\s+/)[0] || 'there',
    property: { name: property.name || '', street: property.street || '', city: property.city || '', state: property.state || '', zip: property.zip || '' },
    rent: row ? { due: row.due, paid: row.paid, balance: row.balance, status: row.status, phase: row.phase, dueDate: row.dueDate, daysPast: row.daysPast } : null,
    priorOwed: prior.map(x => ({ monthKey: x.monthKey, due: x.due })),
    terms,
    lease: { start: tenant.leaseStart || '', end: tenant.leaseEnd || '', kind: lease.kind, label: lease.label, monthlyRent: parseFloat(property.monthlyRent) || 0, deposit: parseFloat(tenant.securityDeposit) || 0 },
    payments,
    payInstructions: (settings.payInstructions || '').trim(),
    fromName: settings.fromName || 'Rainbow Rentals',
    smsOk: tenant.smsOk !== false,
  };
};

/** Find the tenant (and property) whose phone matches `phone`. */
export const findTenantByPhone = (properties, phone) => {
  const want = normalizePhone(phone);
  if (!want) return null;
  for (const p of properties) {
    for (const t of getPropertyTenants(p)) {
      if (normalizePhone(t.phone) === want) return { property: p, tenant: t };
    }
  }
  return null;
};

/**
 * Automatic reminder schedule. `auto` = settings.auto:
 *   { enabled, daysBefore (e.g. 3), onDueDay (bool), afterGraceDays (e.g. 1), repeatEveryDays (e.g. 7) }
 * Returns the list of { row, tenant, kind, templateId } to send today, skipping anything
 * already sent (same tenant + month + kind) — so the daily job is idempotent.
 */
export const dueAutoReminders = ({ rows, commsLog = [], auto = {} }) => {
  if (!auto.enabled) return [];
  const out = [];
  for (const row of rows) {
    if (row.status === 'paid') continue;
    let kind = null, templateId = null;
    const daysBefore = parseInt(auto.daysBefore ?? 3, 10);
    const afterGrace = parseInt(auto.afterGraceDays ?? 1, 10);
    const repeat = parseInt(auto.repeatEveryDays ?? 7, 10);
    if (row.daysPast === -daysBefore && daysBefore > 0) { kind = 'upcoming'; templateId = 'upcoming'; }
    else if (row.daysPast === 0 && auto.onDueDay !== false) { kind = 'due'; templateId = 'due'; }
    else if (row.phase === 'late') {
      const lateDays = row.daysPast - row.terms.graceDays; // 1 = first day past grace
      if (lateDays === afterGrace) { kind = 'late-1'; templateId = row.status === 'partial' ? 'partial' : 'late'; }
      else if (repeat > 0 && lateDays > afterGrace && (lateDays - afterGrace) % repeat === 0) {
        kind = `late-${Math.floor((lateDays - afterGrace) / repeat) + 1}`; templateId = row.status === 'partial' ? 'partial' : 'late';
      }
    }
    if (!kind) continue;
    if (row.scope === 'upcoming-only' && kind !== 'upcoming') continue;
    if (row.scope === 'late-only' && !kind.startsWith('late')) continue;
    for (const tenant of row.tenants) {
      if (!tenant.phone || tenant.smsOk === false) continue;
      const already = commsLog.some(e => e.auto === kind && e.month === row.monthKey
        && (String(e.tenantId) === String(tenant.id) || (!tenant.id && e.tenantName === tenant.name)));
      if (already) continue;
      out.push({ row, tenant, kind, templateId });
    }
  }
  // One text per tenant per day: when several months qualify, the oldest month wins.
  out.sort((a, b) => (a.row.monthKey || '').localeCompare(b.row.monthKey || ''));
  const seen = new Set();
  return out.filter(d => { const k = String(d.tenant.id || d.tenant.name); if (seen.has(k)) return false; seen.add(k); return true; });
};

/** Rows for last month (late repeats only), this month, and next month (upcoming only). */
export const shiftMonthKey = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const computeAutoRows = ({ properties, rentPayments, commsLog, settings, monthKey, today }) => {
  const mk = (key, scope) => computeRentRows({ properties, rentPayments, commsLog, settings, monthKey: key, today })
    .map(r => ({ ...r, monthKey: key, scope }));
  return [
    ...mk(shiftMonthKey(monthKey, -1), 'late-only'),
    ...mk(monthKey, 'all'),
    ...mk(shiftMonthKey(monthKey, 1), 'upcoming-only'),
  ];
};

/**
 * Earlier months of this year still unpaid (any paid/partial/late record settles a month,
 * matching the Reconcile tab). Returns [{ property, monthKey, due }] oldest first.
 */
export const unpaidPriorMonths = ({ properties, rentPayments, monthKey }) => {
  const [y, m] = monthKey.split('-').map(Number);
  const out = [];
  // Months before the current household moved in are not theirs to owe.
  const movedIn = (p) => {
    const starts = getPropertyTenants(p).filter(t => t.status !== 'former' && t.leaseStart).map(t => String(t.leaseStart).slice(0, 7)).sort();
    return starts[0] || null;
  };
  for (let mm = 1; mm < m; mm++) {
    const key = `${y}-${String(mm).padStart(2, '0')}`;
    rentProperties(properties).forEach(p => {
      const since = movedIn(p);
      if (since && key < since) return;
      const settled = rentPayments.some(r => String(r.propertyId) === String(p.id)
        && ['paid', 'partial', 'late'].includes(r.status)
        && (r.month || r.datePaid || '').startsWith(key));
      if (!settled) out.push({ property: p, monthKey: key, due: parseFloat(p.monthlyRent) || 0 });
    });
  }
  return out;
};

// ---- Tenant list import (Tenants → Paste list) ----
// Parse a pasted list (markdown table, tab- or comma-separated): name, address, phone in any order.
const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
export const parsePastedTenants = (text) => {
  const rows = [];
  text.split(/\r?\n/).forEach(line => {
    const raw = line.trim();
    if (!raw || /^\|?\s*-{2,}/.test(raw)) return;
    let cells = raw.includes('|') ? raw.split('|') : raw.includes('\t') ? raw.split('\t') : raw.split(',');
    cells = cells.map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) return;
    const phone = cells.find(c => PHONE_RE.test(c)) || '';
    const rest = cells.filter(c => c !== phone);
    const address = rest.find(c => /\d/.test(c)) || '';
    const name = rest.find(c => c !== address) || '';
    if (!name || /^(renter|tenant|name)$/i.test(name)) return;
    rows.push({ name, address, phone: phone.replace(/[^\d()+\s.-]/g, '').trim() });
  });
  return rows;
};
const norm = (s) => String(s || '').toLowerCase().replace(/\bnorth\b/g, 'n').replace(/\bsouth\b/g, 's').replace(/\beast\b/g, 'e').replace(/\bwest\b/g, 'w').replace(/[^a-z0-9]/g, '');
export const matchPropertyByAddress = (address, properties) => {
  const a = norm(address);
  if (!a) return null;
  return properties.find(p => {
    const n = norm(p.name), ad = norm(`${p.street || ''} ${p.city || ''}`);
    return (ad && (a.includes(ad) || ad.includes(a))) || (n && n.length > 2 && a.includes(n));
  }) || null;
};


// ---- Lease state (one implementation for every tab) ----
// A lease past its end date is month-to-month unless the tenant is marked fixed-term
// (tenant.leaseType === 'fixed') or explicitly month-to-month from the start.
export const leaseState = (tenant, today = todayLocalStr()) => {
  if (!tenant) return { kind: 'none', days: null, label: '', color: 'text-white/30' };
  if (tenant.leaseType === 'month-to-month') {
    return { kind: 'month-to-month', days: null, label: tenant.leaseEnd ? `Month-to-month since ${formatDate(tenant.leaseEnd)}` : 'Month-to-month', short: 'MTM', color: 'text-white/50' };
  }
  if (!tenant.leaseEnd) return { kind: 'none', days: null, label: '', color: 'text-white/30' };
  const days = Math.round((parseLocalDate(tenant.leaseEnd) - parseLocalDate(today)) / 86400000);
  if (days < 0) {
    if (tenant.leaseType === 'fixed') return { kind: 'expired', days, label: `Expired ${formatDate(tenant.leaseEnd)}`, short: 'Expired', color: 'text-red-400' };
    return { kind: 'month-to-month', days, label: `Month-to-month since ${formatDate(tenant.leaseEnd)}`, short: 'MTM', color: 'text-white/50' };
  }
  if (days <= 30) return { kind: 'expiring', days, label: `${days}d left`, short: `${days}d`, color: 'text-orange-400' };
  if (days <= 90) return { kind: 'active', days, label: `${days}d left`, short: `${days}d`, color: 'text-yellow-400' };
  return { kind: 'active', days, label: `${days}d left`, short: `${days}d`, color: 'text-white/40' };
};

/** Tenants whose lease needs attention: expiring within 30 days, or fixed-term and expired. */
export const leaseAlerts = (properties, today = todayLocalStr()) => {
  const out = [];
  properties.forEach(p => getPropertyTenants(p).forEach(t => {
    if (t.status === 'former') return;
    const st = leaseState(t, today);
    if (st.kind === 'expiring' || st.kind === 'expired') out.push({ property: p, tenant: t, ...st });
  }));
  return out.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
};

/** Rent a tenant is on the hook for, for display: their own share if set, else the property rent. */
export const tenantRent = (tenant, property) =>
  parseFloat(tenant?.monthlyRent) || parseFloat(property?.monthlyRent) || 0;
