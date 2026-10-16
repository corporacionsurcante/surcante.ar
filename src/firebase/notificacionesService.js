import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from './config';

// Las notificaciones las crea el servidor (api/notificar.js) al entrar una cotización,
// o las agencias directamente al crear un operativo (tipo: 'operativo_agencia').

export async function marcarNotificacionesComoLeidas() {
  const q = query(collection(db, 'notificaciones'), where('leida', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs
    .filter(d => d.data().tipo !== 'operativo_agencia')
    .forEach(d => batch.update(d.ref, { leida: true }));
  await batch.commit();
}

export async function marcarNotificacionesEgresadosLeidas() {
  const q = query(
    collection(db, 'notificaciones'),
    where('leida', '==', false),
    where('tipo', '==', 'operativo_agencia'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { leida: true }));
  await batch.commit();
}
