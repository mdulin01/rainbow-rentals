import { db } from './firebase.js';
import { loadAll } from './data.js';
import { cashReceivedInMonth, computeRentRows, getPropertyTenants } from '../../src/rentLogic.js';
import { asArray, currentTenants, easternDate, endingLeases, firstName, inLastWeek, instant, leaseEnd, money, paymentsAsOf, propertyName } from './digest-common.js';

const TOPICS = new Set(['paid', 'will_pay', 'partial', 'question', 'maintenance', 'dispute', 'stop', 'start', 'other']);
const REMINDERS = new Set(['upcoming', 'due', 'late', 'partial']);
const FAILED = new Set(['failed', 'undelivered', 'canceled']);

export async function loadDigestData({ firestore = db() } = {}) {
  const [base, review, inbox, backup] = await Promise.all([
    loadAll({ firestore }),
    firestore.doc('rentalData/expenseReview').get(),
    firestore.doc('rentalData/cardInbox').get(),
    firestore.doc('rentalData/backupMeta').get(),
  ]);
  return { ...base, expenseReview: review.data() || {}, cardInbox: inbox.data() || {}, backupMeta: backup.data() || {} };
}

function openThreads(log, properties, now) {
  const names = new Map(properties.map(p => [String(p.id), propertyName(p)]));
  const key = entry => JSON.stringify([String(entry.propertyId), String(entry.tenantId || entry.tenantName || '')]);
  const current = log.filter(e => names.has(String(e.propertyId)) && instant(e.at) && instant(e.at) <= now);
  const latest = new Map();
  for (const entry of current.filter(e => e.direction === 'in')) {
    if (!latest.has(key(entry)) || instant(entry.at) > instant(latest.get(key(entry)).at)) latest.set(key(entry), entry);
  }
  return [...latest.values()].filter(entry => {
    const replied = instant(entry.repliedAt);
    if (replied && replied <= now && replied >= instant(entry.at)) return false;
    return !current.some(out => key(out) === key(entry) && out.direction === 'out' &&
      (!out.auto || out.auto === 'link') && !FAILED.has(out.delivery) && instant(out.at) >= instant(entry.at));
  }).map(entry => ({
    property: names.get(String(entry.propertyId)),
    lastInboundAt: instant(entry.at).toISOString(),
    awaitingReplyHours: Math.floor((now.getTime() - instant(entry.at).getTime()) / 3600000),
    topic: TOPICS.has(entry.ai?.intent) ? entry.ai.intent : 'other',
  })).sort((a, b) => b.awaitingReplyHours - a.awaitingReplyHours || a.property.localeCompare(b.property));
}

export function buildDigest(data, now = new Date()) {
  const asOf = easternDate(now);
  const monthKey = asOf.slice(0, 7);
  const sourceProperties = asArray(data.properties);
  const tenantsFor = p => currentTenants(getPropertyTenants(p), asOf);
  const properties = sourceProperties.map(p => ({
    ...p, tenants: tenantsFor(p), tenant: null,
    // A future household is not yet occupying a property, even within its move-in month.
    propertyStatus: getPropertyTenants(p).length && !tenantsFor(p).length ? 'vacant' : p.propertyStatus,
  }));
  const rentPayments = paymentsAsOf(data.rentPayments, now);
  const rows = computeRentRows({ properties, rentPayments, settings: data.settings || {}, monthKey, today: asOf });
  const byProperty = new Map(rows.map(row => [String(row.property.id), row]));
  const comms = asArray(data.commsLog).filter(Boolean);
  return {
    asOf,
    properties: properties.map(p => {
      const row = byProperty.get(String(p.id));
      const vacant = ['vacant', 'renovation', 'listed'].includes(p.propertyStatus) || (!p.propertyStatus && !p.tenants.length);
      const status = vacant ? 'vacant' : !row ? null : row.status === 'paid' ? 'paid'
        : row.phase === 'late' ? 'late' : 'partial';
      return {
        name: propertyName(p), tenant: vacant ? null : firstName(p.tenants[0]),
        rentDue: vacant ? 0 : row ? money(row.due) : null,
        rentReceivedThisMonth: money(cashReceivedInMonth({ rentPayments: rentPayments.filter(r => String(r.propertyId) === String(p.id)), monthKey })),
        status, daysLate: status === 'late' ? Math.max(0, row.daysPast) : 0,
        leaseEnds: vacant ? null : leaseEnd(p.tenants),
      };
    }),
    openThreads: openThreads(comms, sourceProperties, now),
    leasesEndingWithin90Days: endingLeases(sourceProperties, tenantsFor, asOf),
    expensesAwaitingReview: asArray(data.expenseReview?.items).filter(item => item?.status === 'pending').length,
    cardInboxUnmatched: asArray(data.cardInbox?.items).filter(item => item &&
      !asArray(data.cardInbox?.dismissed).includes(item.txnId)).length,
    lastBackup: instant(data.backupMeta?.lastAt)?.toISOString() || null,
    remindersSentLast7Days: comms.filter(entry => entry.direction === 'out' && entry.via === 'twilio' &&
      REMINDERS.has(entry.template) && ['sent', 'delivered', 'read'].includes(entry.delivery) && inLastWeek(entry.at, now)).length,
  };
}
