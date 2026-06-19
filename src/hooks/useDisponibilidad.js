import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

function addDays(fecha, n) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(desde, hasta) {
  return Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000);
}

// Retorna el conjunto de celdas ocupadas para un período
function getCeldasOcupadas(viajes, unidadId) {
  const ocupadas = new Set();
  viajes
    .filter(v => v.unidadId === unidadId)
    .forEach(v => {
      const dias = daysBetween(v.desde, v.hasta) + 1;
      for (let i = 0; i < dias; i++) {
        const fecha = addDays(v.desde, i);
        const turnoInicio = i === 0 ? v.turnoSalida : 'M';
        if (turnoInicio === 'M') ocupadas.add(`${fecha}_M`);
        ocupadas.add(`${fecha}_T`);
      }
    });
  return ocupadas;
}

// Verifica si una unidad está disponible en el período pedido
function unidadDisponible(viajes, unidadId, fechaInicio, fechaFin) {
  const ocupadas = getCeldasOcupadas(viajes, unidadId);
  const dias = daysBetween(fechaInicio, fechaFin) + 1;
  for (let i = 0; i < dias; i++) {
    const fecha = addDays(fechaInicio, i);
    // Verificamos ambos turnos de cada día
    if (ocupadas.has(`${fecha}_M`) || ocupadas.has(`${fecha}_T`)) {
      return false;
    }
  }
  return true;
}

export function useDisponibilidad(fechaInicio, fechaFin) {
  const [unidades, setUnidades] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);

  const anio = fechaInicio ? fechaInicio.slice(0, 4) : new Date().getFullYear().toString();

  useEffect(() => {
    // Suscribir a unidades activas
    const unsub = onSnapshot(collection(db, 'unidades'), snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.activa !== false)
        .sort((a, b) => a.interno - b.interno);
      setUnidades(data);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!fechaInicio || !fechaFin) { setLoading(false); return; }
    setLoading(true);
    // Suscribir a viajes del año
    const unsub = onSnapshot(collection(db, `gantt_${anio}`), snap => {
      setViajes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [fechaInicio, fechaFin, anio]);

  // Calcular disponibilidad por unidad
  const disponibilidad = unidades.map(u => ({
    ...u,
    disponible: !fechaInicio || !fechaFin
      ? true
      : unidadDisponible(viajes, u.id, fechaInicio, fechaFin),
  }));

  return { disponibilidad, loading };
}
