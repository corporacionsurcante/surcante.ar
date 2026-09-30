// Servicios Firestore del módulo Egresados (agencias de turismo estudiantil).
//
// Estructura:
//   agencias/{agenciaId}
//   operativos/{opId}                         → un viaje/contingente de una agencia
//   operativos/{opId}/buses/{busId}           → ómnibus del operativo (identificación, capacidad)
//   operativos/{opId}/staff/{staffId}         → conductores y coordinadores (rol)
//   operativos/{opId}/pasajeros/{paxId}
//   operativos/{opId}/itinerario/{YYYY-MM-DD} → diagrama día a día
//   conductores/{id}                          → padrón de conductores Surcante (autocompletar)
//   accesos/{token}                           → links personales (pasajero / conductor / coordinador)
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs,
  onSnapshot, query, where, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { generarToken, limpiarDni } from '../admin/egresados/utils';

const SUBCOLECCIONES = ['buses', 'staff', 'pasajeros', 'itinerario', 'avisos', 'reportes', 'ubicaciones', 'checkins'];
const LOTE = 400; // Firestore permite 500 operaciones por batch

const mapDocs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

async function commitEnLotes(operaciones) {
  for (let i = 0; i < operaciones.length; i += LOTE) {
    const batch = writeBatch(db);
    operaciones.slice(i, i + LOTE).forEach(op => op(batch));
    await batch.commit();
  }
}

// ---------------- AGENCIAS ----------------
// onError recibe el error de Firestore (ej. permission-denied si faltan las reglas)
export function suscribirAgencias(cb, onError) {
  return onSnapshot(query(collection(db, 'agencias'), orderBy('nombre')), snap => cb(mapDocs(snap)), onError);
}

export function crearAgencia(data) {
  return addDoc(collection(db, 'agencias'), { ...data, activa: true, creadoEn: serverTimestamp() });
}

export function actualizarAgencia(id, data) {
  return updateDoc(doc(db, 'agencias', id), { ...data, actualizadoEn: serverTimestamp() });
}

export function eliminarAgencia(id) {
  return deleteDoc(doc(db, 'agencias', id));
}

// ---------------- OPERATIVOS ----------------
export function suscribirTodosOperativos(cb, onError) {
  return onSnapshot(collection(db, 'operativos'), snap => cb(mapDocs(snap)), onError);
}

export function suscribirOperativo(opId, cb, onError) {
  return onSnapshot(doc(db, 'operativos', opId), snap => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

// Crea el operativo y, opcionalmente, N ómnibus iniciales ("Bus 1", "Bus 2", ...)
export async function crearOperativo(data, busesIniciales = []) {
  const ref = await addDoc(collection(db, 'operativos'), {
    ...data,
    estado: data.estado || 'planificacion',
    creadoEn: serverTimestamp(),
  });
  if (busesIniciales.length) {
    await commitEnLotes(busesIniciales.map(b => batch => {
      batch.set(doc(collection(db, 'operativos', ref.id, 'buses')), { ...b, creadoEn: serverTimestamp() });
    }));
  }
  return ref;
}

export function actualizarOperativo(opId, data) {
  return updateDoc(doc(db, 'operativos', opId), { ...data, actualizadoEn: serverTimestamp() });
}

// Borra el operativo con todas sus subcolecciones y sus links de acceso
export async function eliminarOperativo(opId) {
  const ops = [];
  for (const sub of SUBCOLECCIONES) {
    const snap = await getDocs(collection(db, 'operativos', opId, sub));
    snap.docs.forEach(d => ops.push(batch => batch.delete(d.ref)));
  }
  const accesos = await getDocs(query(collection(db, 'accesos'), where('opId', '==', opId)));
  accesos.docs.forEach(d => ops.push(batch => batch.delete(d.ref)));
  ops.push(batch => batch.delete(doc(db, 'operativos', opId)));
  await commitEnLotes(ops);
}

// ---------------- SUBCOLECCIONES (genérico) ----------------
const sub = (opId, nombre) => collection(db, 'operativos', opId, nombre);

export function suscribirSub(opId, nombre, cb, onError) {
  return onSnapshot(sub(opId, nombre), snap => cb(mapDocs(snap)), onError);
}

export function crearEnSub(opId, nombre, data) {
  return addDoc(sub(opId, nombre), { ...data, creadoEn: serverTimestamp() });
}

export function guardarEnSub(opId, nombre, id, data) {
  return setDoc(doc(db, 'operativos', opId, nombre, id), { ...data, actualizadoEn: serverTimestamp() }, { merge: true });
}

export function actualizarEnSub(opId, nombre, id, data) {
  return updateDoc(doc(db, 'operativos', opId, nombre, id), { ...data, actualizadoEn: serverTimestamp() });
}

export function eliminarEnSub(opId, nombre, id) {
  return deleteDoc(doc(db, 'operativos', opId, nombre, id));
}

// ---------------- BUSES ----------------
export async function crearBuses(opId, lista) {
  await commitEnLotes(lista.map(b => batch => {
    batch.set(doc(sub(opId, 'buses')), { ...b, creadoEn: serverTimestamp() });
  }));
}

// Elimina un bus y deja sin asignar a sus pasajeros y personal
export async function eliminarBus(opId, busId, pasajeros, staff) {
  const ops = [];
  pasajeros.filter(p => p.busId === busId).forEach(p => ops.push(batch =>
    batch.update(doc(db, 'operativos', opId, 'pasajeros', p.id), { busId: null })));
  staff.filter(s => s.busId === busId).forEach(s => ops.push(batch =>
    batch.update(doc(db, 'operativos', opId, 'staff', s.id), { busId: null })));
  ops.push(batch => batch.delete(doc(db, 'operativos', opId, 'buses', busId)));
  await commitEnLotes(ops);
}

// ---------------- STAFF (conductores / coordinadores) ----------------
export async function eliminarStaff(opId, staffId, pasajeros, accesos) {
  const ops = [];
  pasajeros.filter(p => p.coordinadorId === staffId).forEach(p => ops.push(batch =>
    batch.update(doc(db, 'operativos', opId, 'pasajeros', p.id), { coordinadorId: null })));
  accesos.filter(a => a.refId === staffId).forEach(a => ops.push(batch => batch.delete(doc(db, 'accesos', a.id))));
  ops.push(batch => batch.delete(doc(db, 'operativos', opId, 'staff', staffId)));
  await commitEnLotes(ops);
}

// Padrón global de conductores Surcante (para autocompletar en otros operativos)
export function suscribirConductores(cb, onError) {
  return onSnapshot(collection(db, 'conductores'), snap => cb(mapDocs(snap)), onError);
}

export async function upsertConductor(data) {
  const dni = limpiarDni(data.dni);
  if (!dni) return;
  const { nombre = '', apellido = '', telefono = '', licencia = '', vencLicencia = '' } = data;
  await setDoc(doc(db, 'conductores', `DNI-${dni}`), {
    nombre, apellido, dni, telefono, licencia, vencLicencia, actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

// ---------------- PASAJEROS ----------------
// lista: [{ id?: existente, ...datos }] — si trae id actualiza, si no crea
export async function guardarPasajerosMasivo(opId, lista) {
  await commitEnLotes(lista.map(({ id, ...data }) => batch => {
    if (id) batch.set(doc(db, 'operativos', opId, 'pasajeros', id), { ...data, actualizadoEn: serverTimestamp() }, { merge: true });
    else batch.set(doc(sub(opId, 'pasajeros')), { ...data, creadoEn: serverTimestamp() });
  }));
}

// cambios: [{ id, data }]
export async function actualizarPasajerosMasivo(opId, cambios) {
  await commitEnLotes(cambios.map(({ id, data }) => batch =>
    batch.update(doc(db, 'operativos', opId, 'pasajeros', id), data)));
}

export async function eliminarPasajerosMasivo(opId, ids, accesos = []) {
  const set = new Set(ids);
  const ops = ids.map(id => batch => batch.delete(doc(db, 'operativos', opId, 'pasajeros', id)));
  accesos.filter(a => set.has(a.refId)).forEach(a => ops.push(batch => batch.delete(doc(db, 'accesos', a.id))));
  await commitEnLotes(ops);
}

// ---------------- ACCESOS (links personales) ----------------
export function suscribirAccesos(opId, cb, onError) {
  return onSnapshot(query(collection(db, 'accesos'), where('opId', '==', opId)), snap => cb(mapDocs(snap)), onError);
}

// personas: [{ rol, refId, nombre }]
export async function generarAccesos(opId, personas) {
  const creados = [];
  await commitEnLotes(personas.map(p => batch => {
    const token = generarToken();
    creados.push({ id: token, ...p });
    batch.set(doc(db, 'accesos', token), {
      opId, rol: p.rol, refId: p.refId, nombre: p.nombre || '', activo: true, creadoEn: serverTimestamp(),
    });
  }));
  return creados;
}

export function marcarAccesoEnviado(token) {
  return updateDoc(doc(db, 'accesos', token), { enviadoEn: serverTimestamp() });
}

export function eliminarAcceso(token) {
  return deleteDoc(doc(db, 'accesos', token));
}

// Revoca el link actual y crea uno nuevo para la misma persona
export async function regenerarAcceso(opId, accesoViejo) {
  const batch = writeBatch(db);
  const token = generarToken();
  batch.delete(doc(db, 'accesos', accesoViejo.id));
  batch.set(doc(db, 'accesos', token), {
    opId, rol: accesoViejo.rol, refId: accesoViejo.refId, nombre: accesoViejo.nombre || '',
    activo: true, creadoEn: serverTimestamp(),
  });
  await batch.commit();
  return token;
}
