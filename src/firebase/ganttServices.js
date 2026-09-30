import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch,
  onSnapshot, query, orderBy, where, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from './config';

function manejarError(onError, contexto) {
  return (e) => {
    console.error(`[Firestore] ${contexto}:`, e);
    if (onError) onError(e);
  };
}

// ---- UNIDADES ----
export function suscribirUnidades(callback, onError) {
  const q = query(collection(db, 'unidades'), orderBy('interno'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, manejarError(onError, 'unidades'));
}

export async function agregarUnidad(data) {
  return addDoc(collection(db, 'unidades'), { ...data, creadoEn: serverTimestamp() });
}

export async function actualizarUnidad(id, data) {
  return updateDoc(doc(db, 'unidades', id), { ...data, actualizadoEn: serverTimestamp() });
}

export async function eliminarUnidad(id) {
  return deleteDoc(doc(db, 'unidades', id));
}

// ---- VIAJES (ocupación del Gantt) ----
// Cada viaje se guarda en `gantt_{año de salida}` (datos completos, solo admin) y en
// `ocupacion/{mismo id}` (solo unidad + fechas + turnos, lectura pública para que el
// cotizador muestre disponibilidad sin exponer destinos, notas ni usuarios).
const colGantt = anio => collection(db, `gantt_${anio}`);
const anioDe = fecha => Number(String(fecha).slice(0, 4));

function datosOcupacion(v) {
  return {
    unidadId: v.unidadId,
    desde: v.desde,
    hasta: v.hasta,
    turnoSalida: v.turnoSalida || 'M',
    turnoRegreso: v.turnoRegreso || 'T',
    anio: anioDe(v.desde),
    actualizadoEn: serverTimestamp(),
  };
}

export function suscribirViajes(anio, callback, onError) {
  const q = query(colGantt(anio), orderBy('desde'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, anio, ...d.data() })));
  }, manejarError(onError, `gantt_${anio}`));
}

export async function agregarViaje(data) {
  const ref = doc(colGantt(anioDe(data.desde)));
  const batch = writeBatch(db);
  batch.set(ref, { ...data, creadoEn: serverTimestamp() });
  batch.set(doc(db, 'ocupacion', ref.id), datosOcupacion(data));
  await batch.commit();
  return ref;
}

// Si cambia el año de salida, el viaje se mueve de colección conservando su id
export async function actualizarViaje(viaje, data) {
  const anioViejo = viaje.anio || anioDe(viaje.desde);
  const anioNuevo = anioDe(data.desde);
  const completo = { ...viaje, ...data };
  delete completo.id;
  delete completo.anio;
  const batch = writeBatch(db);
  if (anioViejo === anioNuevo) {
    batch.update(doc(db, `gantt_${anioNuevo}`, viaje.id), { ...data, actualizadoEn: serverTimestamp() });
  } else {
    batch.delete(doc(db, `gantt_${anioViejo}`, viaje.id));
    batch.set(doc(db, `gantt_${anioNuevo}`, viaje.id), { ...completo, actualizadoEn: serverTimestamp() });
  }
  batch.set(doc(db, 'ocupacion', viaje.id), datosOcupacion(completo));
  await batch.commit();
}

export async function eliminarViaje(viaje) {
  const anio = viaje.anio || anioDe(viaje.desde);
  const batch = writeBatch(db);
  batch.delete(doc(db, `gantt_${anio}`, viaje.id));
  batch.delete(doc(db, 'ocupacion', viaje.id));
  await batch.commit();
}

// Ocupación pública (cotizador): viajes que terminan en o después de `desde`
export function suscribirOcupacion(desde, callback, onError) {
  const col = collection(db, 'ocupacion');
  const q = desde ? query(col, where('hasta', '>=', desde)) : col;
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, manejarError(onError, 'ocupacion'));
}

// Inicializar unidades desde la planilla de Surcante
export async function inicializarUnidades() {
  const unidades = [
    { interno: 101, patente: 'AA 883 MF', tipo: 'MIX 60', butacas: 60, empresa: 'SURCANTE' },
    { interno: 104, patente: 'AC 196 IM', tipo: 'MIX 60', butacas: 60, empresa: 'SURCANTE' },
    { interno: 201, patente: 'AH 704 NR', tipo: 'MIX 60', butacas: 60, empresa: 'SURCANTE' },
    { interno: 202, patente: 'AG 010 YB', tipo: 'MIX 60', butacas: 60, empresa: 'SURCANTE' },
    { interno: 203, patente: 'AG 010 YT', tipo: 'MIX 60', butacas: 60, empresa: 'SURCANTE' },
    { interno: 53,  patente: 'AB 862 HL', tipo: 'Comun 45', butacas: 45, empresa: 'SURCANTE' },
    { interno: 55,  patente: 'AE 598 LP', tipo: 'Comun 45', butacas: 45, empresa: 'SURCANTE' },
    { interno: 54,  patente: 'AF 684 AW', tipo: 'Comun 45', butacas: 45, empresa: 'SURCANTE' },
  ];
  for (const u of unidades) {
    await setDoc(doc(db, 'unidades', `INT-${u.interno}`), { ...u, creadoEn: serverTimestamp() });
  }
}
