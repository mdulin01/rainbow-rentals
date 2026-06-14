/* Firebase Cloud Messaging service worker — background push + notification taps.
   Service workers can't read import.meta.env, so the (public) web config is inline. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCHkestt-F4NqtzNmPbMzDwLNQ6g8xFAjM',
  authDomain: 'rainbow-rentals.firebaseapp.com',
  projectId: 'rainbow-rentals',
  storageBucket: 'rainbow-rentals.firebasestorage.app',
  messagingSenderId: '558747458333',
  appId: '1:558747458333:web:3f0483e2d67588473a9ff4',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || 'Rainbow Rentals', {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/?source=push' },
    vibrate: [180, 80, 180],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
