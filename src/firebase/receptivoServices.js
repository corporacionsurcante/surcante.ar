import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from './config';
import { CITY_TOUR_USD, CIRCUITOS, TRANSFERS_AEROPUERTO } from '../data/receptivo';

// ---- PRECIOS CITY TOUR ----
const logError = (ctx, onError) => e => { console.error(`[Firestore] ${ctx}:`, e); if (onError) onError(e); };

export function suscribirPreciosCityTour(callback, onError) {
  return onSnapshot(doc(db, 'config', 'receptivo_citytour'), snap => {
    callback(snap.exists() ? snap.data() : null);
  }, logError('config/receptivo_citytour', onError));
}

export async function actualizarPreciosCityTour(data) {
  return setDoc(doc(db, 'config', 'receptivo_citytour'), { ...data, actualizadoEn: serverTimestamp() });
}

export async function inicializarPreciosCityTour() {
  return setDoc(doc(db, 'config', 'receptivo_citytour'), {
    ...CITY_TOUR_USD,
    actualizadoEn: serverTimestamp(),
  });
}

// ---- CIRCUITOS ----
export function suscribirCircuitos(callback, onError) {
  return onSnapshot(collection(db, 'receptivo_circuitos'), snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data.length > 0 ? data : null);
  }, logError('receptivo_circuitos', onError));
}

export async function agregarCircuito(data) {
  return addDoc(collection(db, 'receptivo_circuitos'), { ...data, creadoEn: serverTimestamp() });
}

export async function actualizarCircuito(id, data) {
  return updateDoc(doc(db, 'receptivo_circuitos', id), { ...data, actualizadoEn: serverTimestamp() });
}

export async function eliminarCircuito(id) {
  return deleteDoc(doc(db, 'receptivo_circuitos', id));
}

export async function inicializarCircuitos() {
  for (const c of CIRCUITOS) {
    await setDoc(doc(db, 'receptivo_circuitos', c.id), {
      nombre: c.nombre,
      emoji: c.emoji,
      descripcion: c.descripcion,
      precioUSD: c.precioUSD,
      activo: true,
      creadoEn: serverTimestamp(),
    });
  }
}

// ---- TRANSFERS ----
export function suscribirTransfers(callback, onError) {
  return onSnapshot(collection(db, 'receptivo_transfers'), snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data.length > 0 ? data : null);
  }, logError('receptivo_transfers', onError));
}

export async function actualizarTransfer(id, data) {
  return updateDoc(doc(db, 'receptivo_transfers', id), { ...data, actualizadoEn: serverTimestamp() });
}

export async function inicializarTransfers() {
  for (const t of TRANSFERS_AEROPUERTO) {
    await setDoc(doc(db, 'receptivo_transfers', t.id), {
      nombre: t.nombre,
      emoji: t.emoji,
      descripcion: t.descripcion,
      precioUSD: t.precioUSD,
      activo: true,
      creadoEn: serverTimestamp(),
    });
  }
}
