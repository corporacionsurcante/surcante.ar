import { IVA, KM_MOV_INCLUIDOS } from '../data/constants';

export function formatARS(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

export function calcKmTotal(kmBaseOrigen, kmOrigenDestino) {
  return kmBaseOrigen * 2 + kmOrigenDestino * 2;
}

export function calcKmExtra(movPorDia, movKmPorDia) {
  let extra = 0;
  movPorDia.forEach((movs, i) => {
    if (movs > 0) {
      const kmMov = movKmPorDia[i] || 0;
      const excedente = Math.max(0, kmMov - KM_MOV_INCLUIDOS);
      extra += excedente * movs;
    }
  });
  return extra;
}

export function calcPrecioUnidad({ unit, kmTotal, movPorDia, movKmPorDia, dolar }) {
  const kmExtra = calcKmExtra(movPorDia, movKmPorDia);
  const kmTotalConExtra = kmTotal + kmExtra;

  // Traslado base
  const traslNeto = kmTotalConExtra * unit.usdKm * dolar;

  // Movimientos
  let movNeto = 0;
  const grupos = { 1: 0, 2: 0, 3: 0 };
  movPorDia.forEach((m) => { if (m > 0 && m <= 3) grupos[m]++; });
  [1, 2, 3].forEach((m) => {
    if (grupos[m] > 0) {
      const usdDia = unit.movUSD[m - 1] * (1 - unit.movDesc);
      movNeto += usdDia * dolar * grupos[m];
    }
  });

  const subtotal = traslNeto + movNeto;
  const ivaTotal = subtotal * IVA;
  const total = subtotal + ivaTotal;

  return {
    kmTotalConExtra,
    kmExtra,
    traslNeto,
    movNeto,
    subtotal,
    ivaTotal,
    total,
    grupos,
  };
}

export function calcPresupuestoTotal({ flotaUnidades, kmTotal, movData, movKmData, syncMode, dolar }) {
  let grandTotal = 0;
  const detalles = flotaUnidades.map((u) => {
    const movPorDia = syncMode ? movData['_sync'] : (movData[u.id] || []);
    const movKmPorDia = syncMode ? movKmData['_sync'] : (movKmData[u.id] || []);
    const calc = calcPrecioUnidad({ unit: u.type, kmTotal, movPorDia, movKmPorDia, dolar });
    grandTotal += calc.total;
    return { ...u, ...calc };
  });
  return { grandTotal, detalles };
}

export function calcSena(total) {
  return total * 0.30;
}

export function getNights(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0;
  const ms = new Date(fechaFin) - new Date(fechaInicio);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}


export const PRECIO_MINIMO_USD = {
  'MIX 60':    450,
  'Comun 45':  400,
  'Minibus 24': 380,
  'Minibus 19': 380,
};
export const KM_MINIMO_THRESHOLD = 300;

export function calcPrecioUnidadConMinimo({ unit, kmTotal, movPorDia, movKmPorDia, dolar, mismodia }) {
  const base = calcPrecioUnidad({ unit, kmTotal, movPorDia, movKmPorDia, dolar });
  
  // Aplicar precio mínimo solo si es viaje en el día y menos de 300 km
  if (mismodia && kmTotal < KM_MINIMO_THRESHOLD) {
    const tipoKey = unit.tipoNombre || unit.tipo || 'Comun 45';
    const minimoUSD = PRECIO_MINIMO_USD[tipoKey] || 400;
    const minimoNeto = minimoUSD * dolar;
    const minimoIva = minimoNeto * IVA;
    const minimoTotal = minimoNeto + minimoIva;
    
    if (minimoTotal > base.total) {
      return {
        ...base,
        traslNeto: minimoNeto,
        ivaTotal: minimoIva,
        total: minimoTotal,
        esPrecioMinimo: true,
        minimoUSD,
      };
    }
  }
  return { ...base, esPrecioMinimo: false };
}
