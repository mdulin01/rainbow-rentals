// rentLogic.js — pure, environment-free rent/reminder logic shared by the React app
// (Rent Day, composer, Action Items) and the Vercel API functions (daily reminder cron,
// inbound SMS). No React, no Firebase, no browser globals.
import { reminderTemplates } from './constants.js';
import { formatCurrency, formatDate, monthName, rentDueDateStr, fillTemplate, parseLocalDate, normalizePhone } from './utils.js';

/** Tenants array from a property, handling legacy single-tenant data. */
export const getPropertyTenants = (property) => {
  if (!property) return [];
  if (Array.isArray(property.tenants) && property.tenants.length > 0) return property.tenants;
  if (property.tenant && property.tenant.name) return [{ id: 'legacy', ...property.tenant }];
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
export const reminderVars = ({ property, tenant, monthKey, terms, settings = {}, amountDue, balance, from }) => {
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
    from: settings.fromName || from || 'Rainbow Rentals',
  };
};

export const renderReminder = (templateId, vars) =>
  fillTemplate((reminderTemplates.find(x => x.id === templateId) || reminderTemplates[0]).text, vars);

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
