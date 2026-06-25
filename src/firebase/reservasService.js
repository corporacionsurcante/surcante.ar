import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export async function guardarReserva(data) {
  return addDoc(collection(db, 'reservas'), {
    ...data,
    estado: 'seña_pendiente',
    creadoEn: serverTimestamp(),
  });
}
