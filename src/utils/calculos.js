import { PARAMETROS_DEFAULT } from './parametros';

export function formatARS(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

export function calcKmTotal(kmBaseOrigen, kmOrigenDestino) {
  return kmBaseOrigen * 2 + kmOrigenDestino * 2;
}

// Precio (USD) de un día de movimientos en destino: se suma el valor de cada movimiento
// que agrega el cliente. movUSD = [1er movimiento, 2do movimiento, 3ro y siguientes (c/u)].
// Ej. [303.69, 269.94, 236.20] → 1 mov = 303,69 · 2 mov = 573,63 · 3 mov = 809,83 · 4 mov = 1.046,03
export function precioMovimientosDiaUSD(movUSD, movs) {
  const lista = Array.isArray(movUSD) ? movUSD : [];
  let usd = 0;
  for (let k = 0; k < movs; k++) {
    const v = Number(lista[Math.min(k, 2)]);
    usd += Number.isFinite(v) ? v : 0;
  }
  return usd;
}

export function calcPrecioUnidad({ unit, kmTotal, movPorDia, movKmPorDia, dolar, params = PARAMETROS_DEFAULT }) {
  // Traslado base — solo km ida y vuelta, sin sumar km de movimientos
  const traslNeto = kmTotal * unit.usdKm * dolar;

  // Movimientos en destino: suma de los movimientos del día.
  // Si los km del día superan los km incluidos → se cobran km extra × precio/km
  let movNeto = 0;
  let kmExtraMovTotal = 0;

  (movPorDia || []).forEach((movs, i) => {
    if (!(movs > 0)) return;
    const kmMov = (movKmPorDia || [])[i] || 0;

    const usdMovDia = precioMovimientosDiaUSD(unit.movUSD, movs) * (1 - (unit.movDesc || 0));
    movNeto += usdMovDia * dolar;

    const kmExtraDia = Math.max(0, kmMov - params.kmMovIncluidos);
    if (kmExtraDia > 0) {
      kmExtraMovTotal += kmExtraDia;
      movNeto += kmExtraDia * unit.usdKm * dolar;
    }
  });

  const subtotal = traslNeto + movNeto;
  const ivaTotal = subtotal * params.iva;
  const total = subtotal + ivaTotal;

  return {
    kmTotalConExtra: kmTotal, // ya no sumamos km de movimientos al traslado
    kmExtra: kmExtraMovTotal,
    traslNeto,
    movNeto,
    subtotal,
    ivaTotal,
    total,
  };
}

export function calcPresupuestoTotal({ flotaUnidades, kmTotal, movData, movKmData, syncMode, dolar, mismodia, dias, params = PARAMETROS_DEFAULT }) {
  let grandTotal = 0;
  const detalles = flotaUnidades.map((u) => {
    const movPorDia = syncMode ? movData['_sync'] : (movData[u.id] || []);
    const movKmPorDia = syncMode ? movKmData['_sync'] : (movKmData[u.id] || []);
    const calc = calcPrecioUnidadConMinimo({ unit: u.type, kmTotal, movPorDia, movKmPorDia, dolar, mismodia, dias, params });
    grandTotal += calc.total;
    return { ...u, ...calc };
  });
  return { grandTotal, detalles };
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

// Valor base de contratación de la unidad (se suma al km en viajes hasta 300 km)
export const VALOR_BASE_USD = {
  'MIX 60':     320,
  'Comun 45':   280,
  'Minibus 24': 245,
  'Minibus 19': 245,
};
// Valores por defecto: los vigentes se editan en Admin → Precios → Configuración general
export const KM_BASE_THRESHOLD = PARAMETROS_DEFAULT.kmBaseThreshold; // hasta este km aplica el valor base

// Descuento por días consecutivos de tarifa mínima
// Día 1: 0%, Días 2-5: 10%, Día 6+: 20%
export function getDescuentoDia(dia) {
  if (dia <= 1) return 0;
  if (dia <= 5) return 0.10;
  return 0.20;
}

// Calcula tarifa mínima total para N días con escala de descuento
export function calcTarifaMinimaDias(tipoNombre, dias, dolar, params = PARAMETROS_DEFAULT) {
  const usdBase = PRECIO_MINIMO_USD[tipoNombre] || 400;
  let totalNeto = 0;
  for (let dia = 1; dia <= dias; dia++) {
    const descuento = getDescuentoDia(dia);
    totalNeto += usdBase * (1 - descuento) * dolar;
  }
  const ivaTotal = totalNeto * params.iva;
  return { totalNeto, ivaTotal, total: totalNeto + ivaTotal };
}

export const KM_ESTADIA_THRESHOLD = PARAMETROS_DEFAULT.kmEstadiaThreshold; // menos de esto + más de 3 días → estadía

export function calcPrecioUnidadConMinimo({ unit, kmTotal, movPorDia, movKmPorDia, dolar, mismodia, dias, params = PARAMETROS_DEFAULT }) {
  const base = calcPrecioUnidad({ unit, kmTotal, movPorDia, movKmPorDia, dolar, params });
  const diasViaje = mismodia ? 1 : (dias || 1);
  const tipoKey = unit.tipoNombre || unit.tipo || 'Comun 45';
  const minimoUSD = PRECIO_MINIMO_USD[tipoKey] || 400;

  const valorBaseUSD = unit.valorBaseUSD || (VALOR_BASE_USD[tipoKey] || 280);

  // CASO 1: Viaje corto (≤300 km totales)
  // Km se cotizan una sola vez.
  // Valor base: si el viaje dura 1, 2 o 3 días → todos los días pagan base
  //             si dura 4 días o más → el primer día no paga (días - 1)
  if (kmTotal <= params.kmBaseThreshold) {
    const diasOcupacion = diasViaje <= 3 ? diasViaje : diasViaje - 1;
    const baseNeto = valorBaseUSD * diasOcupacion * dolar;
    const subtotal = base.traslNeto + baseNeto + base.movNeto;
    const ivaTotal = subtotal * params.iva;
    const total = subtotal + ivaTotal;
    return {
      ...base,
      baseNeto,
      valorBaseUSD,
      diasOcupacion,
      subtotal, ivaTotal, total,
      esPrecioMinimo: false,
      esEstadia: false,
      esValorBase: diasOcupacion > 0,
      tipoKey, diasViaje,
    };
  }

  // CASO 2: Media distancia (301-800 km) + más de 3 días → km + estadía desde día 3
  if (kmTotal < params.kmEstadiaThreshold && diasViaje > 3) {
    const diasEstadia = diasViaje - 2;
    const estadiaNeto = minimoUSD * diasEstadia * dolar;
    const subtotal = base.traslNeto + estadiaNeto + base.movNeto;
    const ivaTotal = subtotal * params.iva;
    const total = subtotal + ivaTotal;
    return {
      ...base,
      estadiaNeto,
      diasEstadia,
      subtotal, ivaTotal, total,
      esPrecioMinimo: false,
      esEstadia: true,
      esValorBase: false,
      tipoKey, diasViaje,
    };
  }

  // CASO 3: Larga distancia (>800 km) → solo km × precio/km
  return { ...base, esPrecioMinimo: false, esEstadia: false, esValorBase: false, tipoKey, diasViaje };
}
