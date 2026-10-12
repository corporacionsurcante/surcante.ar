import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from './config';

// Las notificaciones las crea el servidor (api/notificar.js) al entrar una cotización.

export async function marcarNotificacionesComoLeidas() {
  const q = query(collection(db, 'notificaciones'), where('leida', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { leida: true }));
  await batch.commit();
}
