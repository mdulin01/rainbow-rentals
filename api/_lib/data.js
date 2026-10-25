// Firestore helpers shared by the SMS functions. Document shapes mirror the app:
//   rentalData/properties { properties: [...] }
//   rentalData/rent       { payments: [...] }
//   rentalData/comms      { settings: {...}, log: [...] }   (newest first, capped 500)
//   pushTokens/{uid}      { token, email }
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db, messaging } from './firebase.js';

export async function loadAll({ firestore = db() } = {}) {
  const d = firestore;
  const [p, r, c] = await Promise.all([
    d.doc('rentalData/properties').get(),
    d.doc('rentalData/rent').get(),
    d.doc('rentalData/comms').get(),
  ]);
  return {
    properties: (p.exists && p.data().properties) || [],
    rentPayments: (r.exists && r.data().payments) || [],
    settings: (c.exists && c.data().settings) || {},
    commsLog: (c.exists && c.data().log) || [],
  };
}

/** Append entries to the comms log inside a transaction (safe against concurrent writers). */
export async function appendCommsLog(entries) {
  if (!entries.length) return;
  const ref = db().doc('rentalData/comms');
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const log = (snap.exists && snap.data().log) || [];
    const next = [...entries, ...log].slice(0, 500);
    tx.set(ref, { log: next, lastUpdated: new Date().toISOString() }, { merge: true });
  });
}

/** Patch one log entry by id (delivery status, AI triage, replied flag). */
export async function patchCommsEntry(id, patch) {
  const ref = db().doc('rentalData/comms');
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const log = (snap.exists && snap.data().log) || [];
    const next = log.map(e => e.id === id ? { ...e, ...patch } : e);
    tx.set(ref, { log: next, lastUpdated: new Date().toISOString() }, { merge: true });
  });
}

/** Merge `patch` into one tenant record (by id; legacy single-tenant records too). */
export async function patchTenant(propertyId, tenantId, patch, by = 'sms') {
  const ref = db().doc('rentalData/properties');
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const props = (snap.exists && snap.data().properties) || [];
    const next = props.map(p => String(p.id) !== String(propertyId) ? p : {
      ...p,
      tenants: (p.tenants || []).map(t => String(t.id) === String(tenantId) ? { ...t, ...patch } : t),
      tenant: p.tenant && (!tenantId || String(tenantId).startsWith('legacy')) ? { ...p.tenant, ...patch } : p.tenant,
    });
    tx.set(ref, { properties: next, lastUpdated: new Date().toISOString(), updatedBy: by }, { merge: true });
  });
}

/** Flip a tenant's smsOk flag (STOP / START keywords). */
export const setTenantSmsOk = (propertyId, tenantId, smsOk) => patchTenant(propertyId, tenantId, { smsOk });

/** The tenant's private portal token, minting and saving one if missing. */
export async function ensurePortalToken(property, tenant) {
  if (tenant.portalToken) return tenant.portalToken;
  const token = randomBytes(16).toString('hex');
  await patchTenant(property.id, tenant.id, { portalToken: token }, 'portal');
  tenant.portalToken = token;
  return token;
}

/** Web-push every manager who has a token. Best effort; dead tokens are removed. */
export async function pushManagers({ title, body, url = '/?section=rentday' }) {
  try {
    const snap = await db().collection('pushTokens').get();
    const docs = snap.docs.filter(d => d.data().token);
    if (!docs.length) return 0;
    const res = await messaging().sendEach(docs.map(d => ({
      token: d.data().token,
      notification: { title, body },
      data: { url },
      webpush: { fcmOptions: { link: url } },
    })));
    await Promise.all(res.responses.map((r, i) => {
      const code = r.error?.code || '';
      return (code.includes('registration-token-not-registered') || code.includes('invalid-argument'))
        ? docs[i].ref.update({ token: FieldValue.delete(), staleAt: new Date().toISOString() }) : null;
    }));
    return res.successCount;
  } catch (e) { console.error('push failed', e); return 0; }
}

/**
 * Weekly snapshot of every rentalData document into rentalData/backup-YYYY-MM-DD
 * (keeps the newest 8; rentalData/backupMeta tracks them). Called from the daily cron;
 * no-ops unless the last snapshot is more than 6.5 days old. Returns the date written or null.
 */
export async function weeklyBackup({ force = false } = {}) {
  const d = db();
  const metaRef = d.doc('rentalData/backupMeta');
  const meta = (await metaRef.get()).data() || {};
  if (!force && meta.lastAt && Date.now() - new Date(meta.lastAt).getTime() < 6.5 * 86400000) return null;
  const snap = await d.collection('rentalData').get();
  const data = {};
  for (const docSnap of snap.docs) {
    if (docSnap.id.startsWith('backup')) continue; // never nest backups
    const v = docSnap.data();
    // documents can carry big base64 files — keep only the index
    data[docSnap.id] = docSnap.id === 'documents' && Array.isArray(v.documents)
      ? { ...v, documents: v.documents.map(({ fileData, ...rest }) => rest) } : v;
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  await d.doc(`rentalData/backup-${dateStr}`).set({ json: JSON.stringify(data), at: new Date().toISOString(), by: 'cron' });
  const dates = [...new Set([...(meta.dates || []), dateStr])].sort();
  for (const old of dates.slice(0, Math.max(0, dates.length - 8))) {
    try { await d.doc(`rentalData/backup-${old}`).delete(); } catch { /* ignore */ }
  }
  await metaRef.set({ lastAt: new Date().toISOString(), dates: dates.slice(-8) });
  return dateStr;
}
