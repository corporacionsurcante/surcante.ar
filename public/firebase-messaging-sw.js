/* eslint-disable no-undef */
// Service Worker de Firebase Cloud Messaging — recibe push aunque la app esté cerrada.
// La config de Firebase llega por query string al registrarlo (ver src/firebase/pushService.js).
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || payload.notification?.title || '🚌 Surcante';
  const body = payload.data?.body || payload.notification?.body || 'Nueva cotización recibida';
  self.registration.showNotification(title, {
    body,
    icon: '/Logo_Surcante_01.png',
    badge: '/Logo_Surcante_01.png',
    tag: 'surcante-cotizacion',
    data: { url: payload.data?.url || '/admin' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes('/admin') && 'focus' in w) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});
