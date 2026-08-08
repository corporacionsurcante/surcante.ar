// Notificaciones push (FCM) para el panel admin.
// En iPhone: agregar /admin a la pantalla de inicio (PWA) y tocar "Activar notificaciones".
// Requiere REACT_APP_FIREBASE_VAPID_KEY (ver INSTRUCCIONES.md).
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './config';

function configQueryString() {
  return new URLSearchParams({
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
  }).toString();
}

export async function pushSoportado() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  try { return await isSupported(); } catch (_) { return false; }
}

// Pide permiso, registra el service worker y guarda el token del dispositivo en Firestore.
export async function activarNotificacionesPush(email) {
  if (!(await pushSoportado())) {
    throw new Error('Este dispositivo no soporta notificaciones push. En iPhone: primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.');
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('Permiso de notificaciones denegado. Activalo desde Ajustes del dispositivo.');
  }

  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${configQueryString()}`);
  await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (!token) throw new Error('No se pudo obtener el token de notificaciones.');

  await setDoc(doc(db, 'fcm_tokens', token), {
    token,
    email: email || '',
    userAgent: navigator.userAgent,
    actualizadoEn: serverTimestamp(),
  });

  // Notificaciones con la app abierta (primer plano)
  onMessage(messaging, (payload) => {
    const title = payload.data?.title || payload.notification?.title || '🚌 Surcante';
    const body = payload.data?.body || payload.notification?.body || 'Nueva cotización recibida';
    try {
      reg.showNotification(title, {
        body,
        icon: '/Logo_Surcante_01.png',
        tag: 'surcante-cotizacion',
        data: { url: '/admin' },
      });
    } catch (_) { /* noop */ }
  });

  window.localStorage.setItem('surcante_push_activo', '1');
  return token;
}

export function pushYaActivado() {
  return window.localStorage.getItem('surcante_push_activo') === '1' &&
    typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
