// Web push (FCM) client for rainbow-rentals. Requires the app installed to the iOS
// Home Screen for notifications to work on iPhone. VAPID = public Web Push key.
import { getApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';

const VAPID_KEY = 'BJD5KlEf4qRNNTWwNN_FPRtBzfu1PJWx2DCR8qIm-1v6cU25weKHMpHnhujpWmOAJc9J0OtGCYbK0IwjvF0tflM';

export async function requestPushToken({ forceFresh = true } = {}) {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return { ok: false, reason: 'unsupported' };
    if (!(await isSupported().catch(() => false))) return { ok: false, reason: 'unsupported (open from the installed app, not Safari)' };
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'permission ' + permission };
    const messaging = getMessaging(getApp());
    if (forceFresh) { try { await deleteToken(messaging); } catch { /* none */ } }
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    return token ? { ok: true, token } : { ok: false, reason: 'no-token' };
  } catch (e) {
    console.error('requestPushToken failed', e);
    return { ok: false, reason: (e && (e.code || e.message)) || 'error' };
  }
}

export async function listenForeground(cb) {
  try { if (await isSupported().catch(() => false)) onMessage(getMessaging(getApp()), cb); } catch { /* ignore */ }
}
