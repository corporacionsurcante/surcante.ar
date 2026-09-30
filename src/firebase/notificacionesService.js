import { collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './config';

// Las notificaciones las crea el servidor (api/notificar.js) al entrar una cotización.

export async function marcarNotificacionesComoLeidas() {
  const q = query(collection(db, 'notificaciones'), where('leida', '==', false));
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map((d) => updateDoc(d.ref, { leida: true }))
  );
}
