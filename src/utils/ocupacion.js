// Lógica compartida del Diagrama (Gantt) y de la disponibilidad del cotizador.
// Cada viaje ocupa medio-días (turnos M = mañana, T = tarde) desde `desde`/`turnoSalida`
// hasta `hasta`/`turnoRegreso`, ambos inclusive.

export function addDays(fecha, n) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + n);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysBetween(desde, hasta) {
  return Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000);
}

// Turnos ocupados por un viaje: [{ fecha, turno }]
export function turnosDeViaje(v) {
  if (!v?.desde || !v?.hasta) return [];
  const total = daysBetween(v.desde, v.hasta);
  if (total < 0 || total > 400) return [];
  const out = [];
  for (let i = 0; i <= total; i++) {
    const fecha = addDays(v.desde, i);
    const primero = i === 0;
    const ultimo = i === total;
    // Mañana libre si sale a la tarde; tarde libre si regresa a la mañana
    if (!(primero && v.turnoSalida === 'T')) out.push({ fecha, turno: 'M' });
    if (!(ultimo && v.turnoRegreso === 'M')) out.push({ fecha, turno: 'T' });
  }
  return out;
}

// Mapa `${unidadId}_${fecha}_${turno}` → viaje
export function mapaCeldas(viajes) {
  const celdas = {};
  viajes.forEach(v => {
    turnosDeViaje(v).forEach(({ fecha, turno }) => {
      celdas[`${v.unidadId}_${fecha}_${turno}`] = v;
    });
  });
  return celdas;
}

// Valida un viaje del formulario. Devuelve un mensaje de error o ''.
export function validarViaje({ desde, hasta, turnoSalida, turnoRegreso }) {
  if (!desde || !hasta) return 'Completá las fechas de salida y regreso.';
  const dias = daysBetween(desde, hasta);
  if (dias < 0) return 'El regreso no puede ser anterior a la salida.';
  if (dias === 0 && turnoSalida === 'T' && turnoRegreso === 'M') return 'En un viaje de un solo día, el regreso no puede ser a la mañana si la salida es a la tarde.';
  if (dias > 366) return 'El viaje no puede durar más de un año.';
  return '';
}

// Viajes de la misma unidad que se superponen con `viaje` (excluye el propio id)
export function superposiciones(viaje, viajes) {
  const propios = new Set(turnosDeViaje(viaje).map(t => `${t.fecha}_${t.turno}`));
  return viajes.filter(v =>
    v.id !== viaje.id &&
    v.unidadId === viaje.unidadId &&
    turnosDeViaje(v).some(t => propios.has(`${t.fecha}_${t.turno}`)));
}

// ¿La unidad está libre todos los días del período pedido (días completos)?
export function unidadLibre(viajes, unidadId, fechaInicio, fechaFin) {
  if (!fechaInicio) return true;
  const fin = fechaFin || fechaInicio;
  const pedidos = new Set();
  const total = Math.max(0, daysBetween(fechaInicio, fin));
  for (let i = 0; i <= total; i++) pedidos.add(addDays(fechaInicio, i));
  return !viajes.some(v => v.unidadId === unidadId && turnosDeViaje(v).some(t => pedidos.has(t.fecha)));
}
