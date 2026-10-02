// Tarifa dinámica por fines de semana largos — Surcante
// Lógica pura (sin Firebase). Todas las fechas son strings 'YYYY-MM-DD' (hora Argentina),
// se comparan como texto para evitar errores de zona horaria.

export const MULTIPLICADOR_DEFAULT = 2;
export const MARGEN_ANTES_DEFAULT = 1;   // la salida suele ser el día anterior al finde largo
export const MARGEN_DESPUES_DEFAULT = 0;

export const CONFIG_TARIFA_DEFAULT = {
  activa: false,
  multiplicador: MULTIPLICADOR_DEFAULT,
  margenAntes: MARGEN_ANTES_DEFAULT,
  margenDespues: MARGEN_DESPUES_DEFAULT,
  excluidos: [],     // ids de fines de semana largos que NO llevan recargo
  fechasExtra: [],   // [{ desde, hasta, motivo }] fechas de alta demanda cargadas a mano
};

// Calendario de respaldo (Argentina.gob.ar / Jefatura de Gabinete, Res. 164/2025 y Ley 27.399).
// Se usa solo mientras Firestore (config/feriadosAR) no tenga datos. La tarea mensual lo reemplaza.
export const FERIADOS_SEMILLA = [
  { fecha: '2026-10-12', nombre: 'Día del Respeto a la Diversidad Cultural', tipo: 'trasladable' },
  { fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional (trasladado del 20/11)', tipo: 'trasladable' },
  { fecha: '2026-12-07', nombre: 'Día no laborable con fines turísticos', tipo: 'puente' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción de María', tipo: 'inamovible' },
  { fecha: '2026-12-25', nombre: 'Navidad', tipo: 'inamovible' },
  { fecha: '2027-01-01', nombre: 'Año Nuevo', tipo: 'inamovible' },
];

// ---------- utilidades de fecha (UTC, sin husos) ----------
const MS_DIA = 86400000;

function aMs(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function deMs(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function sumarDias(iso, n) {
  return deMs(aMs(iso) + n * MS_DIA);
}

function diaSemana(iso) {
  return new Date(aMs(iso)).getUTCDay(); // 0 = domingo, 6 = sábado
}

function diasEntre(desde, hasta) {
  return Math.round((aMs(hasta) - aMs(desde)) / MS_DIA) + 1;
}

export function hoyAR() {
  // Fecha de hoy en Argentina (UTC-3), independiente del huso del dispositivo
  const ar = new Date(Date.now() - 3 * 3600000);
  return deMs(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()));
}

// ---------- fines de semana largos ----------
// Un fin de semana largo = bloque de 3 o más días corridos sin trabajo (sábados, domingos,
// feriados y días no laborables con fines turísticos) que incluye al menos un feriado/puente.
export function calcularFindesLargos(feriados) {
  const lista = (feriados || []).filter(f => f && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha));
  const porFecha = new Map(lista.map(f => [f.fecha, f]));
  const esLibre = iso => porFecha.has(iso) || [0, 6].includes(diaSemana(iso));

  const vistos = new Map();
  lista.forEach(f => {
    let desde = f.fecha;
    let hasta = f.fecha;
    while (esLibre(sumarDias(desde, -1))) desde = sumarDias(desde, -1);
    while (esLibre(sumarDias(hasta, 1))) hasta = sumarDias(hasta, 1);
    const dias = diasEntre(desde, hasta);
    if (dias < 3) return;
    const id = `${desde}_${hasta}`;
    if (vistos.has(id)) return;
    const nombres = [];
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
      if (porFecha.has(d)) nombres.push(porFecha.get(d).nombre);
    }
    vistos.set(id, { id, desde, hasta, dias, nombre: nombres.join(' + ') });
  });
  return Array.from(vistos.values()).sort((a, b) => a.desde.localeCompare(b.desde));
}

// Ventana de recargo = fin de semana largo + márgenes configurables
export function ventanaTarifa(finde, margenAntes = MARGEN_ANTES_DEFAULT, margenDespues = MARGEN_DESPUES_DEFAULT) {
  return {
    desde: sumarDias(finde.desde, -Math.max(0, Number(margenAntes) || 0)),
    hasta: sumarDias(finde.hasta, Math.max(0, Number(margenDespues) || 0)),
  };
}

const seSolapan = (aDesde, aHasta, bDesde, bHasta) => aDesde <= bHasta && aHasta >= bDesde;

// ¿El viaje [fechaInicio, fechaFin] cae en un período de tarifa dinámica?
export function evaluarTarifaDinamica({ fechaInicio, fechaFin, config, findes }) {
  const cfg = { ...CONFIG_TARIFA_DEFAULT, ...(config || {}) };
  const sinRecargo = { aplica: false, multiplicador: 1, motivo: '' };
  if (!cfg.activa || !fechaInicio) return sinRecargo;

  const ini = String(fechaInicio).slice(0, 10);
  const fin = String(fechaFin || fechaInicio).slice(0, 10);
  const mult = Number(cfg.multiplicador) > 1 ? Number(cfg.multiplicador) : MULTIPLICADOR_DEFAULT;

  for (const f of findes || []) {
    if ((cfg.excluidos || []).includes(f.id)) continue;
    const v = ventanaTarifa(f, cfg.margenAntes, cfg.margenDespues);
    if (seSolapan(ini, fin, v.desde, v.hasta)) {
      return { aplica: true, multiplicador: mult, motivo: f.nombre || 'Fin de semana largo', ventana: v };
    }
  }
  for (const e of cfg.fechasExtra || []) {
    if (e?.desde && seSolapan(ini, fin, e.desde, e.hasta || e.desde)) {
      return { aplica: true, multiplicador: mult, motivo: e.motivo || 'Fecha de alta demanda', ventana: { desde: e.desde, hasta: e.hasta || e.desde } };
    }
  }
  return sinRecargo;
}

// Aplica el multiplicador a un total ya calculado (en ARS o USD, es indistinto)
export function aplicarTarifaDinamica(total, { fechaInicio, fechaFin, config, findes }) {
  const ev = evaluarTarifaDinamica({ fechaInicio, fechaFin, config, findes });
  const base = Number(total) || 0;
  if (!ev.aplica) return { total: base, base, recargo: 0, ...ev };
  const nuevo = base * ev.multiplicador;
  return { total: nuevo, base, recargo: nuevo - base, ...ev };
}

// Resumen que se guarda en la reserva (Firestore no admite undefined: se usa null)
export function resumenTarifa(td, recargoConIva) {
  if (!td || !td.aplica) return null;
  return {
    aplica: true,
    multiplicador: td.multiplicador,
    motivo: td.motivo || '',
    recargo: Math.round(Number(recargoConIva) || 0),
  };
}

// Campos en dinero del detalle de una unidad de charter (se escalan todos juntos
// para que subtotal + IVA = total siga cerrando en pantalla)
const CAMPOS_DINERO = ['traslNeto', 'movNeto', 'baseNeto', 'estadiaNeto', 'subtotal', 'ivaTotal', 'total'];

export function escalarDetalle(detalle, multiplicador) {
  if (!detalle || !(multiplicador > 1)) return detalle;
  const r = { ...detalle };
  CAMPOS_DINERO.forEach(k => { if (typeof r[k] === 'number') r[k] = r[k] * multiplicador; });
  return r;
}
