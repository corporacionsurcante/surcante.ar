import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, orderBy, onSnapshot, serverTimestamp, setDoc, getDoc
} from 'firebase/firestore';
import { db } from './config';

// Errores de Firestore en suscripciones: se registran y se avisa al componente
// (si no, las pantallas quedan en "Cargando..." para siempre).
function manejarError(onError, contexto) {
  return (e) => {
    console.error(`[Firestore] ${contexto}:`, e);
    if (onError) onError(e);
  };
}

// ---- RESERVAS ----
export function suscribirReservas(callback, onError) {
  const q = query(collection(db, 'reservas'), orderBy('creadoEn', 'desc'));
  return onSnapshot(q, snap => {
    const reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(reservas);
  }, manejarError(onError, 'reservas'));
}

// Avisa al panel admin (notificación + push) desde el servidor.
// keepalive: el aviso sale aunque el cliente sea redirigido a MercadoPago.
export function notificarNuevaReserva(reservaId) {
  try {
    fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservaId }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) { /* noop */ }
}

export async function crearReserva(data) {
  const reservaRef = await addDoc(collection(db, 'reservas'), {
    ...data,
    estado: 'seña_pendiente',
    creadoEn: serverTimestamp(),
  });
  notificarNuevaReserva(reservaRef.id);
  return reservaRef;
}

export async function actualizarEstadoReserva(id, estado) {
  return updateDoc(doc(db, 'reservas', id), { estado, actualizadoEn: serverTimestamp() });
}

// ---- FLOTA ----
export async function getFlota() {
  const snap = await getDocs(collection(db, 'flota'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function suscribirFlota(callback, onError) {
  return onSnapshot(collection(db, 'flota'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, manejarError(onError, 'flota'));
}

export async function actualizarUnidad(id, data) {
  return updateDoc(doc(db, 'flota', id), { ...data, actualizadoEn: serverTimestamp() });
}

// ---- PRECIOS ----
export async function getPrecios() {
  const snap = await getDoc(doc(db, 'config', 'precios'));
  return snap.exists() ? snap.data() : null;
}

// callback(null) si el documento todavía no existe
export function suscribirPrecios(callback, onError) {
  return onSnapshot(doc(db, 'config', 'precios'), snap => {
    callback(snap.exists() ? snap.data() : null);
  }, manejarError(onError, 'config/precios'));
}

export async function actualizarPrecios(data) {
  return setDoc(doc(db, 'config', 'precios'), { ...data, actualizadoEn: serverTimestamp() });
}

export async function inicializarPrecios() {
  await setDoc(doc(db, 'config', 'precios'), {
    u1: { movUSD: [110, 170, 250], movDesc: 0, usdKm: 2.50 },
    u2: { movUSD: [110, 170, 250], movDesc: 0.20, usdKm: 2.00 },
    u3: { movUSD: [110, 170, 250], movDesc: 0.30, usdKm: 1.80 },
    kmMovIncluidos: 50,
    iva: 0.21,
    senaPorc: 0.30,
    actualizadoEn: serverTimestamp(),
  });
}

// ---- ADMINS AUTORIZADOS ----
// Devuelve false si la cuenta no está en /admins (o si las reglas no le permiten
// consultarlo). Los errores de red se propagan para poder mostrarlos.
export async function isAdminAutorizado(email) {
  if (!email) return false;
  try {
    const snap = await getDoc(doc(db, 'admins', email));
    return snap.exists();
  } catch (e) {
    if (e?.code === 'permission-denied') return false;
    throw e;
  }
}
