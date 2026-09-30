// Parámetros generales de cotización — se editan en Admin → Precios → "Configuración general"
// (documento config/precios). Si un valor falta o es inválido se usa el valor por defecto.

export const PARAMETROS_DEFAULT = {
  iva: 0.21,               // IVA sobre el neto
  senaPorc: 0.30,          // seña con transferencia o efectivo
  senaOnlinePorc: 0.10,    // pago inicial online (MercadoPago / tarjeta)
  kmBaseThreshold: 300,    // hasta estos km totales: viaje corto (km + valor base por día)
  kmEstadiaThreshold: 800, // por debajo de estos km y más de 3 días: km + estadía
  kmMovIncluidos: 150,     // km incluidos por día de movimientos en destino
};

function numero(v) {
  if (typeof v === 'string') return parseFloat(v.replace(',', '.'));
  return Number(v);
}

function enRango(v, def, min, max) {
  const n = numero(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

export function normalizarParametros(doc) {
  const d = doc || {};
  const D = PARAMETROS_DEFAULT;
  return {
    iva: enRango(d.iva, D.iva, 0, 1),
    senaPorc: enRango(d.senaPorc, D.senaPorc, 0.01, 1),
    senaOnlinePorc: enRango(d.senaOnlinePorc, D.senaOnlinePorc, 0.01, 1),
    kmBaseThreshold: enRango(d.kmBaseThreshold, D.kmBaseThreshold, 0, 100000),
    kmEstadiaThreshold: enRango(d.kmEstadiaThreshold, D.kmEstadiaThreshold, 0, 100000),
    kmMovIncluidos: enRango(d.kmMovIncluidos, D.kmMovIncluidos, 0, 100000),
  };
}

export function esPagoOnline(payMethod) {
  return payMethod === 'mercadopago' || payMethod === 'tarjeta';
}

export function porcentajeSena(payMethod, params = PARAMETROS_DEFAULT) {
  return esPagoOnline(payMethod) ? params.senaOnlinePorc : params.senaPorc;
}

// 0.21 → "21%", 0.105 → "10,5%"
export function fmtPorc(x) {
  const v = Math.round((Number(x) || 0) * 1000) / 10;
  return `${String(v).replace('.', ',')}%`;
}

// Métodos de pago con el porcentaje vigente (mismo orden y textos en todos los cotizadores)
export function metodosPago(params = PARAMETROS_DEFAULT) {
  const sena = fmtPorc(params.senaPorc);
  const online = fmtPorc(params.senaOnlinePorc);
  return [
    { id: 'transferencia', label: 'Transferencia', icon: '🏛️', desc: `Transferís el ${sena} para confirmar`, porc: params.senaPorc, online: false },
    { id: 'efectivo',      label: 'Efectivo',      icon: '💵', desc: 'Coordinás por WhatsApp', porc: params.senaPorc, online: false },
    { id: 'mercadopago',   label: 'MercadoPago',   icon: '💳', desc: `Pagás el ${online} ahora online`, porc: params.senaOnlinePorc, online: true },
    { id: 'tarjeta',       label: 'Tarjeta',       icon: '🏦', desc: `Pagás el ${online} ahora online`, porc: params.senaOnlinePorc, online: true },
  ];
}
