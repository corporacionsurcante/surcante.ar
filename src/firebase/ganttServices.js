import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from './config';

// ---- UNIDADES ----
export function suscribirUnidades(callback) {
  const q = query(collection(db, 'unidades'), orderBy('interno'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
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
export function suscribirViajes(anio, callback) {
  const q = query(collection(db, `gantt_${anio}`), orderBy('desde'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function agregarViaje(anio, data) {
  return addDoc(collection(db, `gantt_${anio}`), {
    ...data,
    creadoEn: serverTimestamp(),
  });
}

export async function actualizarViaje(anio, id, data) {
  return updateDoc(doc(db, `gantt_${anio}`, id), { ...data, actualizadoEn: serverTimestamp() });
}

export async function eliminarViaje(anio, id) {
  return deleteDoc(doc(db, `gantt_${anio}`, id));
}

// Bloquear unidades desde una reserva online
export async function bloquearDesdeReserva(anio, reserva) {
  const { flotaUnidades, fechaInicio, fechaFin, destino } = reserva;
  const color = '#7B2FBE';
  for (const u of flotaUnidades) {
    await addDoc(collection(db, `gantt_${anio}`), {
      unidadId: u.id,
      destino: destino || 'Reserva online',
      desde: fechaInicio,
      hasta: fechaFin,
      turnoSalida: 'M',
      turnoRegreso: 'T',
      color,
      fromReserva: true,
      creadoEn: serverTimestamp(),
    });
  }
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
