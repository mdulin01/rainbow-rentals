import assert from 'node:assert/strict';
import test from 'node:test';
import { createDigestHandler } from '../api/digest.js';
import { buildDigest, loadDigestData } from '../api/_lib/digest.js';

const secret = 'fictional-digest-secret';
const at = new Date('2026-11-03T17:00:00Z');
const property = (id = 'sample', extra = {}) => ({
  id, name: `Sample ${id}`, propertyStatus: 'occupied', monthlyRent: 1500,
  tenants: [{ id: `tenant-${id}`, name: 'Avery PrivateSurname', phone: '202-555-0198', email: 'avery@example.invalid',
    portalToken: 'PRIVATE_PORTAL_TOKEN', leaseStart: '2026-01-01', leaseEnd: '2027-01-31', rentDueDay: 1, graceDays: 5 }],
  ...extra,
});
const payment = (propertyId, extra = {}) => ({ propertyId, amount: 1500, month: '2026-11', datePaid: '2026-11-01', status: 'paid', category: 'rent', incomeType: 'rent', ...extra });
const data = (properties = [property()], rentPayments = [], extra = {}) => ({
  properties, rentPayments, settings: { payInstructions: 'PRIVATE_ZELLE_DETAILS' }, commsLog: [],
  expenseReview: { items: [] }, cardInbox: { items: [] }, backupMeta: {}, expenses: [], documents: [], ...extra,
});
const response = () => ({
  headers: {}, code: null, body: undefined,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.code = code; return this; },
  end(body) { this.body = body; return this; },
  json(body) { this.body = body; return this; },
});
const request = { method: 'GET', headers: { authorization: `Bearer ${secret}` } };

for (const [label, req, configured] of [
  ['no authorization', { method: 'GET', headers: {} }, secret],
  ['wrong secret', { method: 'GET', headers: { authorization: 'Bearer wrong' } }, secret],
  ['same-length wrong secret', { method: 'GET', headers: { authorization: `Bearer ${secret.slice(0, -1)}X` } }, secret],
  ['unset secret', request, undefined],
  ['empty secret', { method: 'GET', headers: { authorization: 'Bearer ' } }, ''],
  ['POST', { ...request, method: 'POST' }, secret],
  ['HEAD', { ...request, method: 'HEAD' }, secret],
]) {
  test(`${label} returns empty 401 without reading data (file spec)`, async () => {
    let reads = 0;
    const handler = createDigestHandler({ load: async () => { reads++; return data(); }, secret: () => configured });
    const res = response();
    await handler(req, res);
    assert.equal(res.code, 401);
    assert.equal(res.body, undefined);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(reads, 0);
  });
}

test('authorized response is an explicit privacy projection, not a copy of stored data', async () => {
  const source = data([property()], [payment('sample', { notes: 'PRIVATE_MESSAGE_BODY', tenantName: 'Avery PrivateSurname' })]);
  source.extra = { phone: '202-555-0198', email: 'avery@example.invalid', portalToken: 'PRIVATE_PORTAL_TOKEN' };
  source.documents = [{ propertyId: 'sample', title: 'Avery PrivateSurname', fileName: 'PRIVATE_MESSAGE_BODY', fileUrl: 'PRIVATE_PORTAL_TOKEN', notes: 'PRIVATE_ZELLE_DETAILS', type: 'lease', createdAt: '2026-11-02T14:00:00Z' }];
  source.commsLog = [{ propertyId: 'sample', tenantId: 'tenant-sample', tenantName: 'Avery PrivateSurname', direction: 'in', at: '2026-11-02T05:00:00Z', text: 'PRIVATE_MESSAGE_BODY', from: '202-555-0198', ai: { intent: 'PRIVATE_MESSAGE_BODY', summary: 'Avery PrivateSurname', reply: 'PRIVATE_ZELLE_DETAILS' } }];
  const before = structuredClone(source);
  const handler = createDigestHandler({ load: async () => source, now: () => at, secret: () => secret });
  const res = response();
  await handler(request, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.properties[0].tenant, 'Avery');
  assert.deepEqual(Object.keys(res.body.properties[0]).sort(), ['daysLate', 'leaseEnds', 'name', 'rentDue', 'rentReceivedThisMonth', 'status', 'tenant']);
  const forbidden = new Set(['phone', 'email', 'text', 'body', 'message', 'messageText', 'summary', 'reply', 'portalToken', 'payInstructions', 'fullName', 'tenantName', 'fileName', 'fileUrl', 'notes']);
  const inspect = value => {
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      assert.equal(forbidden.has(key), false, key);
      inspect(child);
    }
  };
  inspect(res.body);
  const output = JSON.stringify(res.body);
  for (const value of ['PrivateSurname', '202-555-0198', 'avery@example.invalid', 'PRIVATE_PORTAL_TOKEN', 'PRIVATE_ZELLE_DETAILS', 'PRIVATE_MESSAGE_BODY']) assert.equal(output.includes(value), false, value);
  assert.deepEqual(source, before);
});

test('read errors return empty 500 and do not reveal sensitive exception text', async t => {
  const log = t.mock.method(console, 'error', () => {});
  const handler = createDigestHandler({ load: async () => { throw new Error('PRIVATE_SECRET_AND_DATA'); }, secret: () => secret });
  const res = response();
  await handler(request, res);
  assert.equal(res.code, 500);
  assert.equal(res.body, undefined);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(log.mock.calls[0].arguments, ['digest read failed']);
});

for (const [label, payments, now, expected] of [
  ['paid', [payment('sample')], at, 'paid'],
  ['partial before grace ends', [payment('sample', { status: 'partial', amount: 400 })], at, 'partial'],
  ['late without payment', [], new Date('2026-11-07T17:00:00Z'), 'late'],
  ['late with partial payment', [payment('sample', { status: 'partial', amount: 400 })], new Date('2026-11-07T17:00:00Z'), 'late'],
]) {
  test(`rent status: ${label}`, () => {
    const row = buildDigest(data([property()], payments), now).properties[0];
    assert.equal(row.status, expected);
    assert.equal(row.daysLate, expected === 'late' ? 6 : 0);
    assert.equal(row.rentDue, 1500);
  });
}

test('vacant properties do not expose a former tenant or report expected rent', () => {
  const p = property('empty', { propertyStatus: 'vacant' });
  const row = buildDigest(data([p], []), at).properties[0];
  assert.equal(row.status, 'vacant');
  assert.equal(row.rentDue, 0);
  assert.equal(row.tenant, null);
  assert.equal(row.leaseEnds, null);
});

test('Eastern month changes at local midnight, not UTC midnight, across year end', () => {
  const payments = [payment('sample', { month: '2026-12', datePaid: '2026-12-10' })];
  const before = buildDigest(data([property()], payments), new Date('2027-01-01T04:59:59Z'));
  const after = buildDigest(data([property()], payments), new Date('2027-01-01T05:00:00Z'));
  assert.equal(before.asOf, '2026-12-31');
  assert.equal(before.properties[0].status, 'paid');
  assert.equal(before.properties[0].rentReceivedThisMonth, 1500);
  assert.equal(after.asOf, '2027-01-01');
  assert.equal(after.properties[0].rentReceivedThisMonth, 0);
  assert.equal(after.properties[0].status, 'unpaid');
  assert.equal(after.properties[0].daysLate, 0);
});

test('Eastern daylight-time month boundary and UTC payment timestamps use the same calendar', () => {
  const payments = [payment('sample', { month: '2026-07', datePaid: '2026-08-01T02:00:00Z' })];
  const before = buildDigest(data([property()], payments), new Date('2026-08-01T03:59:59Z'));
  const after = buildDigest(data([property()], payments), new Date('2026-08-01T04:00:00Z'));
  assert.equal(before.asOf, '2026-07-31');
  assert.equal(before.properties[0].status, 'paid');
  assert.equal(before.properties[0].rentReceivedThisMonth, 1500);
  assert.equal(after.asOf, '2026-08-01');
  assert.equal(after.properties[0].rentReceivedThisMonth, 0);
  assert.equal(after.properties[0].status, 'unpaid');
  assert.equal(after.properties[0].daysLate, 0);
});

test('prepaid and prior-month cash do not confuse cash received with rent-month settlement', () => {
  const prepaid = buildDigest(data([property()], [payment('sample', { datePaid: '2026-10-31' })]), at).properties[0];
  assert.equal(prepaid.status, 'paid');
  assert.equal(prepaid.rentReceivedThisMonth, 0);
  const lateCash = buildDigest(data([property()], [payment('sample', { month: '2026-10' })]), new Date('2026-11-07T17:00:00Z')).properties[0];
  assert.equal(lateCash.rentReceivedThisMonth, 1500);
  assert.equal(lateCash.status, 'late');
});

test('future payments do not change an as-of digest', () => {
  const row = buildDigest(data([property()], [payment('sample', { datePaid: '2026-11-20' })]), new Date('2026-11-07T17:00:00Z')).properties[0];
  assert.equal(row.status, 'late');
  assert.equal(row.rentReceivedThisMonth, 0);
});

test('former and not-yet-moved-in tenants are not disclosed as the current tenant', () => {
  for (const tenant of [{ name: 'Former PrivateSurname', status: 'former' }, { name: 'Future PrivateSurname', leaseStart: '2026-12-01' }]) {
    const row = buildDigest(data([property('sample', { tenants: [tenant] })]), at).properties[0];
    assert.equal(row.tenant, null);
    assert.equal(row.status, 'vacant');
  }
});

test('leases include day 90, exclude day 91, former tenants and explicit month-to-month leases', () => {
  const today = new Date('2026-11-03T17:00:00Z');
  const p = property('sample', { tenants: [
    { name: 'Avery One', leaseEnd: '2027-02-01' },
    { name: 'Casey Two', leaseEnd: '2027-02-02' },
    { name: 'Former Three', leaseEnd: '2026-12-01', status: 'former' },
    { name: 'Morgan Four', leaseEnd: '2026-12-01', leaseType: 'month-to-month' },
  ] });
  assert.deepEqual(buildDigest(data([p]), today).leasesEndingWithin90Days, ['Sample sample 2027-02-01']);
});

function readonlyStore(documents) {
  const reads = [];
  const source = structuredClone(documents);
  return { reads, source, firestore: { doc(path) {
    reads.push(path);
    return { async get() { return { exists: path in source, data: () => structuredClone(source[path]) }; } };
  } } };
}

test('loader only reads six fixed documents and preserves their contents', async () => {
  const docs = {
    'rentalData/properties': { properties: [property()] },
    'rentalData/rent': { payments: [payment('sample')] },
    'rentalData/comms': { settings: {}, log: [] },
    'rentalData/expenseReview': { items: [] },
    'rentalData/cardInbox': { items: [] },
    'rentalData/backupMeta': { lastAt: '2026-11-01T10:00:00Z' },
  };
  const store = readonlyStore(docs);
  const result = await loadDigestData(store);
  assert.deepEqual(store.reads.sort(), Object.keys(docs).sort());
  assert.deepEqual(store.source, docs);
  assert.equal(buildDigest(result, at).properties[0].status, 'paid');
});

test('empty database yields zero counts and no private or invented data', async () => {
  const result = buildDigest(await loadDigestData(readonlyStore({})), at);
  assert.deepEqual(result, { asOf: '2026-11-03', properties: [], openThreads: [], leasesEndingWithin90Days: [],
    expensesAwaitingReview: 0, cardInboxUnmatched: 0, lastBackup: null, remindersSentLast7Days: 0 });
});

test('threads use newest inbound, a fixed topic label, and distinguish replies from reminders', () => {
  const inbound = (tenantId, extra = {}) => ({ propertyId: 'sample', tenantId, direction: 'in', at: '2026-11-02T05:00:00Z', ...extra });
  const outgoing = (tenantId, extra = {}) => ({ propertyId: 'sample', tenantId, direction: 'out', at: '2026-11-02T06:00:00Z', delivery: 'sent', ...extra });
  const result = buildDigest(data([property()], [], { commsLog: [
    inbound('open', { at: '2026-11-01T05:00:00Z' }),
    inbound('open', { ai: { intent: 'maintenance', summary: 'PRIVATE_MESSAGE_BODY' } }),
    outgoing('open', { auto: 'due' }),
    inbound('manual'), outgoing('manual'),
    inbound('portal'), outgoing('portal', { auto: 'link' }),
    inbound('marked', { repliedAt: '2026-11-02T07:00:00Z' }),
    inbound('failed', { ai: { intent: 'PRIVATE_MESSAGE_BODY' } }), outgoing('failed', { delivery: 'failed' }),
    inbound('future', { at: '2026-11-04T05:00:00Z' }),
    inbound('unknown', { propertyId: 'unknown', propertyName: 'PRIVATE_MESSAGE_BODY' }),
  ] }), at);
  assert.deepEqual(result.openThreads, [
    { property: 'Sample sample', lastInboundAt: '2026-11-02T05:00:00.000Z', awaitingReplyHours: 36, topic: 'maintenance' },
    { property: 'Sample sample', lastInboundAt: '2026-11-02T05:00:00.000Z', awaitingReplyHours: 36, topic: 'other' },
  ]);
});

test('review and unmatched card counts reflect pending queues', () => {
  const result = buildDigest(data([], [], {
    expenseReview: { items: [{ status: 'pending' }, { status: 'accepted' }, { status: 'dismissed' }, { status: 'pending' }] },
    cardInbox: { items: [{ txnId: 'a' }, { txnId: 'b' }, { txnId: 'c' }], dismissed: ['b'] },
  }), at);
  assert.equal(result.expensesAwaitingReview, 2);
  assert.equal(result.cardInboxUnmatched, 2);
});

test('reminders count only confirmed Twilio rent reminders within the past 168 hours', () => {
  const entry = extra => ({ direction: 'out', via: 'twilio', template: 'due', delivery: 'sent', at: '2026-11-02T10:00:00Z', ...extra });
  const result = buildDigest(data([], [], { commsLog: [
    entry({}), entry({ delivery: 'delivered', at: '2026-10-27T17:00:00Z' }),
    entry({ at: '2026-10-27T16:59:59Z' }), entry({ at: '2026-11-04T00:00:00Z' }),
    entry({ delivery: 'failed' }), entry({ delivery: 'queued' }), entry({ via: 'sms' }),
    entry({ direction: 'in' }), entry({ template: 'receipt' }), entry({ template: 'link' }),
  ] }), at);
  assert.equal(result.remindersSentLast7Days, 2);
});

test('rent due reuses move-in proration, and excludes non-rent receipts', () => {
  const p = property('sample');
  p.tenants[0].leaseStart = '2026-11-16';
  const result = buildDigest(data([p], [payment('sample', { amount: 100, incomeType: 'deposit', status: 'partial', datePaid: '2026-11-16' })]), new Date('2026-11-16T17:00:00Z'));
  assert.equal(result.properties[0].rentDue, 750);
  assert.equal(result.properties[0].rentReceivedThisMonth, 0);
});


test('zero payment before the due date and through grace is unpaid', () => {
  const p = property('sample');
  p.tenants[0].rentDueDay = 5;
  for (const payments of [[], [payment('sample', { status: 'unpaid', amount: 0 })]]) {
    for (const date of ['2026-11-01T16:00:00Z', '2026-11-05T16:00:00Z', '2026-11-11T04:59:59Z']) {
      const row = buildDigest(data([p], payments), new Date(date)).properties[0];
      assert.equal(row.status, 'unpaid');
      assert.equal(row.rentReceivedThisMonth, 0);
      assert.equal(row.daysLate, 0);
    }
  }
  const late = buildDigest(data([p]), new Date('2026-11-11T05:00:00Z')).properties[0];
  assert.equal(late.status, 'late');
  assert.equal(late.daysLate, 6);
});

test('DST month and grace boundaries change at Eastern midnight', () => {
  const fixtures = data([property()], [payment('sample', { month: '2026-10', datePaid: '2026-10-02' })]);
  const october = buildDigest(fixtures, new Date('2026-11-01T03:59:59Z'));
  const november = buildDigest(fixtures, new Date('2026-11-01T04:00:00Z'));
  assert.equal(october.asOf, '2026-10-31');
  assert.equal(october.properties[0].status, 'paid');
  assert.equal(november.asOf, '2026-11-01');
  assert.equal(november.properties[0].status, 'unpaid');
  assert.equal(november.properties[0].rentReceivedThisMonth, 0);
  assert.equal(buildDigest(fixtures, new Date('2026-11-07T04:59:59Z')).properties[0].status, 'unpaid');
  const late = buildDigest(fixtures, new Date('2026-11-07T05:00:00Z')).properties[0];
  assert.equal(late.status, 'late');
  assert.equal(late.daysLate, 6);
});

test('vacant and month-to-month property leases are excluded even when an old lease end remains', () => {
  for (const propertyStatus of ['vacant', 'month-to-month']) {
    const result = buildDigest(data([property('sample', { propertyStatus })]), at);
    assert.deepEqual(result.leasesEndingWithin90Days, []);
  }
});
