// Firebase Admin for Vercel functions. Needs FIREBASE_SERVICE_ACCOUNT = the service-account
// JSON (raw or base64) from Firebase console → Project settings → Service accounts.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(json);
}

export function adminApp() {
  if (getApps().length) return getApps()[0];
  const sa = serviceAccount();
  return initializeApp({ credential: cert(sa), projectId: sa.project_id || 'rainbow-rentals' });
}

export const db = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
export const messaging = () => getMessaging(adminApp());

const MANAGERS = (process.env.MANAGER_EMAILS || 'mdulin@gmail.com,dulinliam@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

/** Verify the Firebase ID token in `Authorization: Bearer …` and require a manager email. */
export async function requireManager(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) { const e = new Error('Missing bearer token'); e.status = 401; throw e; }
  const decoded = await adminAuth().verifyIdToken(token);
  const email = (decoded.email || '').toLowerCase();
  if (!MANAGERS.includes(email)) { const e = new Error('Not a manager'); e.status = 403; throw e; }
  return { uid: decoded.uid, email, name: email.includes('mdulin') ? 'Mike' : email.includes('liam') ? 'Liam' : email };
}
