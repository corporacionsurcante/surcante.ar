import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { suscribirOcupacion } from '../firebase/ganttServices';
import { unidadLibre } from '../utils/ocupacion';

// Unidades activas + si están libres en el período pedido.
// Lee `ocupacion` (copia pública del Diagrama). Si no se puede leer, no bloquea al
// cliente: marca `errorDisponibilidad` y la disponibilidad se confirma por WhatsApp.
export function useDisponibilidad(fechaInicio, fechaFin) {
  const [unidades, setUnidades] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorDisponibilidad, setErrorDisponibilidad] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'unidades'), snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.activa !== false)
        .sort((a, b) => Number(a.interno) - Number(b.interno));
      setUnidades(data);
    }, e => console.error('[Firestore] unidades:', e));
    return unsub;
  }, []);

  useEffect(() => {
    if (!fechaInicio || !fechaFin) { setLoading(false); return undefined; }
    setLoading(true);
    return suscribirOcupacion(fechaInicio, data => {
      setViajes(data);
      setErrorDisponibilidad(false);
      setLoading(false);
    }, () => {
      setViajes([]);
      setErrorDisponibilidad(true);
      setLoading(false);
    });
  }, [fechaInicio, fechaFin]);

  const disponibilidad = unidades.map(u => ({
    ...u,
    disponible: !fechaInicio || !fechaFin ? true : unidadLibre(viajes, u.id, fechaInicio, fechaFin),
  }));

  return { disponibilidad, loading, errorDisponibilidad };
}
