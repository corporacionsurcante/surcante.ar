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

export function calcPresupuestoTotal({ flotaUnidades, kmTotal, movData, movKmData, syncMode, dolar, mismodia, dias }) {
  let grandTotal = 0;
  const detalles = flotaUnidades.map((u) => {
    const movPorDia = syncMode ? movData['_sync'] : (movData[u.id] || []);
    const movKmPorDia = syncMode ? movKmData['_sync'] : (movKmData[u.id] || []);
    const calc = calcPrecioUnidadConMinimo({ unit: u.type, kmTotal, movPorDia, movKmPorDia, dolar, mismodia, dias });
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

// Días de servicio inclusive (salida y regreso cuentan como días de trabajo)
export function getDiasServicio(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0;
  const ms = new Date(fechaFin) - new Date(fechaInicio);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}


export const PRECIO_MINIMO_USD = {
  'MIX 60':     450,
  'Comun 45':   400,
  'Minibus 24': 380,
  'Minibus 19': 380,
};
export const KM_MINIMO_THRESHOLD = 300;

// Descuento por días consecutivos de tarifa mínima
// Día 1: 0%, Días 2-5: 10%, Día 6+: 20%
export function getDescuentoDia(dia) {
  if (dia <= 1) return 0;
  if (dia <= 5) return 0.10;
  return 0.20;
}

// Calcula tarifa mínima total para N días con escala de descuento
export function calcTarifaMinimaDias(tipoNombre, dias, dolar) {
  const usdBase = PRECIO_MINIMO_USD[tipoNombre] || 400;
  let totalNeto = 0;
  for (let dia = 1; dia <= dias; dia++) {
    const descuento = getDescuentoDia(dia);
    totalNeto += usdBase * (1 - descuento) * dolar;
  }
  const ivaTotal = totalNeto * IVA;
  return { totalNeto, ivaTotal, total: totalNeto + ivaTotal };
}

export const KM_ESTADIA_THRESHOLD = 800; // menos de esto + más de 3 días → estadía

export function calcPrecioUnidadConMinimo({ unit, kmTotal, movPorDia, movKmPorDia, dolar, mismodia, dias }) {
  const base = calcPrecioUnidad({ unit, kmTotal, movPorDia, movKmPorDia, dolar });
  const diasViaje = mismodia ? 1 : (dias || 1);
  const tipoKey = unit.tipoNombre || unit.tipo || 'Comun 45';
  const minimoUSD = PRECIO_MINIMO_USD[tipoKey] || 400;

  // CASO 1: Mismo día + menos de 300 km → tarifa mínima diaria
  if (mismodia && kmTotal < KM_MINIMO_THRESHOLD) {
    const minimoNeto = minimoUSD * dolar;
    const subtotal = minimoNeto + base.movNeto;
    const ivaTotal = subtotal * IVA;
    const total = subtotal + ivaTotal;
    if (minimoNeto > base.traslNeto) {
      return {
        ...base,
        traslNeto: minimoNeto,
        subtotal, ivaTotal, total,
        esPrecioMinimo: true,
        esEstadia: false,
        tipoKey, diasViaje,
        kmPorDia: kmTotal,
      };
    }
  }

  // CASO 2: Varios días + menos de 800 km + más de 3 días → km + estadía desde día 3
  if (!mismodia && kmTotal < KM_ESTADIA_THRESHOLD && diasViaje > 3) {
    const diasEstadia = diasViaje - 2; // días 3 en adelante
    const estadiaNeto = minimoUSD * diasEstadia * dolar;
    const subtotal = base.traslNeto + estadiaNeto + base.movNeto;
    const ivaTotal = subtotal * IVA;
    const total = subtotal + ivaTotal;
    return {
      ...base,
      estadiaNeto,
      diasEstadia,
      subtotal, ivaTotal, total,
      esPrecioMinimo: false,
      esEstadia: true,
      tipoKey, diasViaje,
      kmPorDia: Math.round(kmTotal / diasViaje),
    };
  }

  // CASO 3: Resto (larga distancia o pocos días) → solo km × precio/km
  return { ...base, esPrecioMinimo: false, esEstadia: false, kmPorDia: Math.round(kmTotal / diasViaje) };
}
