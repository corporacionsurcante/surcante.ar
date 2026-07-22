import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './config';

export async function crearNotificacionCotizacion(data) {
  return addDoc(collection(db, 'notificaciones'), {
    tipo: 'cotizacion_finalizada',
    leida: false,
    creadoEn: serverTimestamp(),
    ...data,
  });
}

export async function marcarNotificacionesComoLeidas() {
  const q = query(collection(db, 'notificaciones'), where('leida', '==', false));
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map((d) => updateDoc(d.ref, { leida: true }))
  );
}
