import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, orderBy, onSnapshot, serverTimestamp, setDoc, getDoc
} from 'firebase/firestore';
import { db } from './config';
import { crearNotificacionCotizacion } from './notificacionesService';

// ---- RESERVAS ----
export function suscribirReservas(callback) {
  const q = query(collection(db, 'reservas'), orderBy('creadoEn', 'desc'));
  return onSnapshot(q, snap => {
    const reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(reservas);
  });
}

export async function crearReserva(data) {
  const reservaRef = await addDoc(collection(db, 'reservas'), {
    ...data,
    estado: 'seña_pendiente',
    creadoEn: serverTimestamp(),
  });
  await crearNotificacionCotizacion({
    reservaId: reservaRef.id,
    servicio: data.tipo || 'charter',
    clienteNombre: data.clienteNombre || '',
    clienteWhatsapp: data.clienteWhatsapp || '',
    origen: data.origen || '',
    destino: data.destino || '',
    grandTotal: data.grandTotal || 0,
    payMethod: data.payMethod || '',
    mensaje: `Nueva cotización ${data.tipo || 'charter'} · ${data.clienteNombre || 'Cliente sin nombre'}`,
  });
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

export function suscribirFlota(callback) {
  return onSnapshot(collection(db, 'flota'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function actualizarUnidad(id, data) {
  return updateDoc(doc(db, 'flota', id), { ...data, actualizadoEn: serverTimestamp() });
}

export async function inicializarFlota() {
  const unidades = [
    { nombre: 'Omnibus Premium', butacas: 60, features: 'A/C · baño · wi-fi', tipo: 'u1', usdKm: 2.50, disponible: true, disponibles: 3 },
    { nombre: 'Omnibus Estándar', butacas: 45, features: 'A/C · baño', tipo: 'u2', usdKm: 2.00, disponible: true, disponibles: 2 },
    { nombre: 'Minibus Ejecutivo', butacas: 24, features: 'A/C', tipo: 'u3', usdKm: 1.80, disponible: true, disponibles: 4 },
  ];
  for (const u of unidades) {
    await setDoc(doc(db, 'flota', u.tipo), { ...u, creadoEn: serverTimestamp() });
  }
}

// ---- PRECIOS ----
export async function getPrecios() {
  const snap = await getDoc(doc(db, 'config', 'precios'));
  return snap.exists() ? snap.data() : null;
}

export function suscribirPrecios(callback) {
  return onSnapshot(doc(db, 'config', 'precios'), snap => {
    if (snap.exists()) callback(snap.data());
  });
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
export async function isAdminAutorizado(email) {
  const snap = await getDoc(doc(db, 'admins', email));
  return snap.exists();
}

export async function agregarAdmin(email) {
  return setDoc(doc(db, 'admins', email), { email, creadoEn: serverTimestamp() });
}
