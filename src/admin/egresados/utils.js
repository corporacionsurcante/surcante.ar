// Utilidades puras del módulo Egresados (sin Firebase) — fechas, links, importación, distribución.

// ---------------- Identificadores ----------------
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // sin 0/O/1/l/I

// Token aleatorio criptográfico (~128 bits) para links personales
export function generarToken(largo = 22) {
  const out = [];
  const max = Math.floor(256 / ALFABETO.length) * ALFABETO.length; // evita sesgo de módulo
  while (out.length < largo) {
    const bytes = new Uint8Array(largo * 2);
    window.crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < max && out.length < largo) out.push(ALFABETO[b % ALFABETO.length]);
    }
  }
  return out.join('');
}

export function limpiarDni(v) {
  return String(v ?? '').replace(/\D/g, '');
}

export function normalizarTexto(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function nombreCompleto(p) {
  if (!p) return '';
  return [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || p.nombreCompleto || '';
}

export function apellidoNombre(p) {
  if (!p) return '';
  const ap = (p.apellido || '').toUpperCase();
  return [ap, p.nombre].filter(Boolean).join(', ');
}

// ---------------- Colores de identificación de buses ----------------
export const COLORES_BUS = [
  { id: 'violeta', label: 'Violeta', hex: '#7B2FBE' },
  { id: 'azul', label: 'Azul', hex: '#1565C0' },
  { id: 'verde', label: 'Verde', hex: '#00A07A' },
  { id: 'naranja', label: 'Naranja', hex: '#F57C00' },
  { id: 'rojo', label: 'Rojo', hex: '#D32F2F' },
  { id: 'rosa', label: 'Rosa', hex: '#D81B60' },
  { id: 'celeste', label: 'Celeste', hex: '#0097D7' },
  { id: 'amarillo', label: 'Amarillo', hex: '#E6A700' },
  { id: 'marron', label: 'Marrón', hex: '#6D4C41' },
  { id: 'gris', label: 'Gris', hex: '#546E7A' },
];

export function colorBus(bus) {
  return COLORES_BUS.find(c => c.id === bus?.color)?.hex || '#7B2FBE';
}

export function ordenarBuses(buses) {
  return [...buses].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
}

// ---------------- Fechas ----------------
const pad = n => String(n).padStart(2, '0');

export function isoLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hoyISO() {
  return isoLocal(new Date());
}

// Lista de fechas ISO entre desde y hasta (inclusive). Máx 60 días por seguridad.
export function rangoFechas(desde, hasta) {
  if (!desde) return [];
  const out = [];
  const d = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta || desde}T12:00:00`);
  while (d <= fin && out.length < 60) {
    out.push(isoLocal(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function labelFecha(iso, { largo = false } = {}) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const txt = d.toLocaleDateString('es-AR', largo
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: '2-digit', month: '2-digit' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function fechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Acepta Date, serial de Excel, "dd/mm/aaaa", "dd-mm-aa", "aaaa-mm-dd" → "aaaa-mm-dd"
export function normalizarFecha(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) return isoLocal(v);
  if (typeof v === 'number' && v > 1000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > 30 ? 1900 : 2000;
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  return '';
}

export function edad(fechaNacimiento, referencia) {
  if (!fechaNacimiento) return null;
  const n = new Date(`${fechaNacimiento}T12:00:00`);
  const r = referencia ? new Date(`${referencia}T12:00:00`) : new Date();
  if (Number.isNaN(n.getTime())) return null;
  let e = r.getFullYear() - n.getFullYear();
  const m = r.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < n.getDate())) e--;
  return e;
}

// ---------------- Links y WhatsApp ----------------
export function linkAcceso(token) {
  return `${window.location.origin}/v/${token}`;
}

// Normaliza teléfonos argentinos al formato que pide wa.me (549 + área + número)
export function telefonoWhatsApp(tel) {
  let d = String(tel ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    let resto = d.slice(2);
    if (resto.startsWith('9')) resto = resto.slice(1);
    if (resto.startsWith('0')) resto = resto.slice(1);
    return `549${quitar15(resto)}`;
  }
  if (d.startsWith('0')) d = d.slice(1);
  d = quitar15(d);
  if (d.length === 10) return `549${d}`;
  return d; // otro país o formato ya internacional
}

function quitar15(d) {
  if (d.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === '15') return d.slice(0, largoArea) + d.slice(largoArea + 2);
    }
  }
  return d;
}

export function linkWhatsApp(tel, texto) {
  const num = telefonoWhatsApp(tel);
  const t = encodeURIComponent(texto || '');
  return num ? `https://wa.me/${num}?text=${t}` : `https://wa.me/?text=${t}`;
}

export const ROLES = {
  pasajero: { label: 'Pasajero', plural: 'Pasajeros', icon: '🎒' },
  conductor: { label: 'Conductor', plural: 'Conductores', icon: '🧑‍✈️' },
  coordinador: { label: 'Coordinador', plural: 'Coordinadores', icon: '📋' },
};

export function mensajeAcceso({ rol, nombre, operativo, bus, link }) {
  const saludo = `Hola ${nombre || ''}!`.replace(' !', '!');
  const viaje = operativo?.nombre ? `*${operativo.nombre}*` : 'tu viaje';
  const busTxt = bus ? ` (${bus.codigo})` : '';
  if (rol === 'conductor') {
    return `${saludo} 🚌 Este es tu acceso de CONDUCTOR para ${viaje}${busTxt} con Surcante.\n\nAbrilo cuando estés en la unidad y tocá "Iniciar servicio" para ponerte en línea. Ahí vas a recibir las indicaciones y avisos en tiempo real, y podés cargar reportes y fotos de la unidad.\n\n${link}\n\nEs personal, no lo compartas.`;
  }
  if (rol === 'coordinador') {
    return `${saludo} 📋 Este es tu acceso de COORDINADOR para ${viaje}${busTxt} con Surcante.\n\nVas a ver el diagrama del día, los datos de tu ómnibus y conductor, y vas a poder escanear el QR de los pasajeros para verificar ómnibus, hotel y coordinador responsable.\n\n${link}\n\nEs personal, no lo compartas.`;
  }
  return `${saludo} 🎒 Este es tu acceso personal para ${viaje} con Surcante.\n\nAhí vas a ver tu ómnibus${busTxt ? ` ${busTxt.trim()}` : ''}, dónde está en tiempo real, los datos de tu coordinador y conductor, y la agenda de cada día con sugerencias.\n\n${link}\n\nEs personal, no lo compartas.`;
}

// ---------------- CSV ----------------
// Parser CSV/TSV con comillas; detecta el separador (tab, ; o ,)
export function parsearTexto(texto) {
  const t = String(texto || '').replace(/^﻿/, '');
  const primera = t.split(/\r?\n/).find(l => l.trim()) || '';
  const sep = [
    ['\t', (primera.match(/\t/g) || []).length],
    [';', (primera.match(/;/g) || []).length],
    [',', (primera.match(/,/g) || []).length],
  ].sort((a, b) => b[1] - a[1])[0][0];

  const filas = [];
  let fila = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"' && celda === '') {
      comillas = true;
    } else if (c === sep) {
      fila.push(celda); celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda); celda = '';
      if (fila.some(x => String(x).trim() !== '')) filas.push(fila);
      fila = [];
    } else {
      celda += c;
    }
  }
  fila.push(celda);
  if (fila.some(x => String(x).trim() !== '')) filas.push(fila);
  return filas;
}

// Descarga un CSV que Excel (es-AR) abre directo: separador ";" + BOM UTF-8
export function descargarCSV(nombreArchivo, encabezados, filas) {
  const esc = v => {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const contenido = [encabezados, ...filas].map(f => f.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- Excel (SheetJS bajo demanda desde su CDN oficial) ----------------
const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

function cargarSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const existente = document.getElementById('sheetjs-script');
    if (existente) {
      existente.addEventListener('load', () => resolve(window.XLSX));
      existente.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.id = 'sheetjs-script';
    s.src = SHEETJS_URL;
    s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisá la conexión o pegá los datos copiados del Excel.'));
    document.head.appendChild(s);
  });
}

// Devuelve { hojas: [nombre], leer(nombreHoja) → filas[][] }
export async function leerArchivoPlanilla(file) {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt') || nombre.endsWith('.tsv')) {
    const texto = await file.text();
    const filas = parsearTexto(texto);
    return { hojas: ['Datos'], leer: () => filas };
  }
  const XLSX = await cargarSheetJS();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  return {
    hojas: wb.SheetNames,
    leer: hoja => XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: '', blankrows: false }),
  };
}

// ---------------- Mapeo de columnas de pasajeros ----------------
export const CAMPOS_PASAJERO = [
  { id: 'apellido', label: 'Apellido', sinonimos: ['apellido', 'apellidos', 'surname', 'last name'] },
  { id: 'nombre', label: 'Nombre', sinonimos: ['nombre', 'nombres', 'name', 'first name'] },
  { id: 'apellidoNombre', label: 'Apellido y nombre (junto)', sinonimos: ['apellido y nombre', 'apellido nombre', 'apellidos y nombres', 'pasajero', 'alumno', 'nombre completo'] },
  { id: 'nombreApellido', label: 'Nombre y apellido (junto)', sinonimos: ['nombre y apellido', 'nombres y apellidos', 'nombre apellido'] },
  { id: 'dni', label: 'DNI / Documento', sinonimos: ['dni', 'documento', 'nro documento', 'n documento', 'numero documento', 'numero de documento', 'nro doc', 'doc', 'n doc', 'numero_documento', 'pasaporte'] },
  { id: 'tipoDoc', label: 'Tipo de documento', sinonimos: ['tipo documento', 'tipo doc', 'tipo de documento', 'tipo_documento'] },
  { id: 'fechaNacimiento', label: 'Fecha de nacimiento', sinonimos: ['fecha nacimiento', 'fecha de nacimiento', 'fecha nac', 'f nac', 'nacimiento', 'fnac'] },
  { id: 'sexo', label: 'Sexo', sinonimos: ['sexo', 'genero'] },
  { id: 'nacionalidad', label: 'Nacionalidad', sinonimos: ['nacionalidad', 'pais'] },
  { id: 'telefono', label: 'Teléfono / WhatsApp', sinonimos: ['telefono', 'tel', 'celular', 'cel', 'whatsapp', 'movil', 'telefono pasajero', 'celular pasajero'] },
  { id: 'email', label: 'Email', sinonimos: ['email', 'mail', 'correo', 'e mail', 'correo electronico'] },
  { id: 'colegio', label: 'Colegio / Grupo', sinonimos: ['colegio', 'escuela', 'institucion', 'establecimiento', 'grupo', 'contingente', 'curso', 'division', 'grupo colegio'] },
  { id: 'hotel', label: 'Hotel', sinonimos: ['hotel', 'alojamiento', 'hospedaje', 'hosteria'] },
  { id: 'habitacion', label: 'Habitación', sinonimos: ['habitacion', 'hab', 'room', 'nro habitacion'] },
  { id: 'bus', label: 'Ómnibus asignado', sinonimos: ['bus', 'omnibus', 'micro', 'unidad', 'coche', 'nro bus', 'n bus', 'interno'] },
  { id: 'asiento', label: 'Asiento / Butaca', sinonimos: ['asiento', 'butaca', 'nro asiento'] },
  { id: 'coordinador', label: 'Coordinador responsable', sinonimos: ['coordinador', 'coordinadora', 'coord', 'responsable', 'coordinador responsable'] },
  { id: 'emergenciaNombre', label: 'Contacto de emergencia', sinonimos: ['contacto emergencia', 'contacto de emergencia', 'tutor', 'padre madre', 'padre', 'madre', 'adulto responsable', 'nombre tutor'] },
  { id: 'emergenciaTel', label: 'Teléfono de emergencia', sinonimos: ['telefono emergencia', 'tel emergencia', 'telefono de emergencia', 'telefono tutor', 'tel tutor', 'celular tutor', 'telefono padre', 'telefono madre', 'tel padres'] },
  { id: 'codigoAgencia', label: 'Código de la agencia (QR / voucher)', sinonimos: ['codigo', 'cod', 'id pasajero', 'nro pasajero', 'voucher', 'legajo', 'codigo pasajero', 'qr', 'id'] },
  { id: 'observaciones', label: 'Observaciones', sinonimos: ['observaciones', 'obs', 'notas', 'nota', 'comentarios', 'dieta', 'alergias', 'observacion'] },
];

export function detectarCampo(encabezado) {
  const h = normalizarTexto(encabezado);
  if (!h) return '';
  // 1) coincidencia exacta con sinónimo
  for (const c of CAMPOS_PASAJERO) if (c.sinonimos.includes(h)) return c.id;
  // 2) el encabezado contiene un sinónimo (priorizando los más largos).
  //    "nombre" es genérico: si hay otra coincidencia ("Nombre del hotel", "Nombre coordinador") gana la otra.
  const coincidencias = [];
  for (const c of CAMPOS_PASAJERO) {
    for (const s of c.sinonimos) {
      if (s.length > 3 && h.includes(s)) coincidencias.push({ id: c.id, largo: s.length });
    }
  }
  const especificas = coincidencias.filter(x => x.id !== 'nombre');
  const pool = especificas.length ? especificas : coincidencias;
  pool.sort((a, b) => b.largo - a.largo);
  return pool[0]?.id || '';
}

// Busca la fila de encabezados entre las primeras 15 y arma el mapeo columna → campo
export function detectarEncabezados(filas) {
  let mejor = { idx: 0, mapeo: [], aciertos: -1 };
  filas.slice(0, 15).forEach((fila, idx) => {
    const mapeo = fila.map(c => detectarCampo(c));
    const usados = new Set();
    const limpio = mapeo.map(m => { if (!m || usados.has(m)) return ''; usados.add(m); return m; });
    const aciertos = limpio.filter(Boolean).length;
    if (aciertos > mejor.aciertos) mejor = { idx, mapeo: limpio, aciertos };
  });
  return mejor;
}

function partirNombre(texto, apellidoPrimero) {
  const s = String(texto || '').trim().replace(/\s+/g, ' ');
  if (!s) return { apellido: '', nombre: '' };
  if (s.includes(',')) {
    const [a, n] = s.split(',');
    return apellidoPrimero ? { apellido: a.trim(), nombre: (n || '').trim() } : { nombre: a.trim(), apellido: (n || '').trim() };
  }
  const partes = s.split(' ');
  if (partes.length === 1) return { apellido: apellidoPrimero ? s : '', nombre: apellidoPrimero ? '' : s };
  return apellidoPrimero
    ? { apellido: partes[0], nombre: partes.slice(1).join(' ') }
    : { nombre: partes.slice(0, -1).join(' '), apellido: partes[partes.length - 1] };
}

const titulo = s => String(s || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, p, l) => p + l.toUpperCase());

function normalizarSexo(v) {
  const s = normalizarTexto(v);
  if (!s) return '';
  if (['m', 'masculino', 'masc', 'varon', 'hombre'].includes(s)) return 'M';
  if (['f', 'femenino', 'fem', 'mujer'].includes(s)) return 'F';
  return 'X';
}

// Busca un bus por texto ("Bus 2", "2", "Violeta", interno "201")
export function buscarBus(texto, buses) {
  const t = normalizarTexto(texto);
  if (!t) return null;
  const num = t.replace(/\D/g, '');
  return buses.find(b => normalizarTexto(b.codigo) === t)
    || buses.find(b => num && String(b.interno || '') === num)
    || buses.find(b => num && normalizarTexto(b.codigo).replace(/\D/g, '') === num)
    || buses.find(b => normalizarTexto(COLORES_BUS.find(c => c.id === b.color)?.label) === t)
    || null;
}

export function buscarStaff(texto, staff, rol) {
  const t = normalizarTexto(texto);
  if (!t) return null;
  const lista = staff.filter(s => !rol || s.rol === rol);
  return lista.find(s => normalizarTexto(nombreCompleto(s)) === t)
    || lista.find(s => normalizarTexto(`${s.apellido} ${s.nombre}`) === t)
    || lista.find(s => t.includes(normalizarTexto(s.apellido)) && normalizarTexto(s.apellido).length > 2)
    || null;
}

// Convierte filas crudas en pasajeros según el mapeo elegido
export function filasAPasajeros(filas, idxEncabezado, mapeo, buses, staff) {
  const out = [];
  filas.slice(idxEncabezado + 1).forEach(fila => {
    const v = {};
    mapeo.forEach((campo, i) => { if (campo) v[campo] = fila[i]; });
    let { apellido = '', nombre = '' } = v;
    if (!apellido && !nombre && v.apellidoNombre) ({ apellido, nombre } = partirNombre(v.apellidoNombre, true));
    if (!apellido && !nombre && v.nombreApellido) ({ apellido, nombre } = partirNombre(v.nombreApellido, false));
    apellido = titulo(String(apellido).trim());
    nombre = titulo(String(nombre).trim());
    if (!apellido && !nombre) return; // fila vacía o de totales

    const bus = buscarBus(v.bus, buses);
    const coord = buscarStaff(v.coordinador, staff, 'coordinador');
    out.push({
      apellido,
      nombre,
      dni: limpiarDni(v.dni),
      tipoDoc: String(v.tipoDoc || 'DNI').trim().toUpperCase() || 'DNI',
      fechaNacimiento: normalizarFecha(v.fechaNacimiento),
      sexo: normalizarSexo(v.sexo),
      nacionalidad: titulo(String(v.nacionalidad || '').trim()) || 'Argentina',
      telefono: String(v.telefono || '').trim(),
      email: String(v.email || '').trim().toLowerCase(),
      colegio: String(v.colegio || '').trim(),
      hotel: String(v.hotel || '').trim(),
      habitacion: String(v.habitacion || '').trim(),
      asiento: String(v.asiento || '').trim(),
      emergenciaNombre: String(v.emergenciaNombre || '').trim(),
      emergenciaTel: String(v.emergenciaTel || '').trim(),
      codigoAgencia: String(v.codigoAgencia || '').trim(),
      observaciones: String(v.observaciones || '').trim(),
      busId: bus?.id || null,
      coordinadorId: coord?.id || null,
      _busTexto: v.bus ? String(v.bus) : '',
      _coordTexto: v.coordinador ? String(v.coordinador) : '',
    });
  });
  return out;
}

// ---------------- Distribución automática en buses ----------------
// Mantiene juntos los grupos (colegio) cuando entran; si un grupo no entra en ningún bus, se reparte.
// Devuelve { cambios: [{id, busId}], resumen: {busId: cantidad}, sinLugar: n }
export function distribuirPasajeros({ pasajeros, buses, staff, soloSinAsignar = true, agrupar = true }) {
  const libres = {};
  buses.forEach(b => {
    const coordsEnBus = staff.filter(s => s.rol === 'coordinador' && s.busId === b.id).length;
    const capacidad = Math.max(0, Number(b.capacidad || 0) - coordsEnBus);
    const yaAsignados = soloSinAsignar ? pasajeros.filter(p => p.busId === b.id).length : 0;
    libres[b.id] = capacidad - yaAsignados;
  });

  const aDistribuir = pasajeros.filter(p => !soloSinAsignar || !p.busId || !buses.some(b => b.id === p.busId));
  const grupos = new Map();
  aDistribuir.forEach(p => {
    const k = agrupar ? (normalizarTexto(p.colegio) || '__sin_grupo__') : '__todos__';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  });
  const ordenGrupos = [...grupos.values()]
    .map(g => g.sort((a, b) => apellidoNombre(a).localeCompare(apellidoNombre(b), 'es')))
    .sort((a, b) => b.length - a.length);

  const cambios = [];
  let sinLugar = 0;
  const busConMasLugar = () => Object.entries(libres).sort((a, b) => b[1] - a[1])[0];

  for (const grupo of ordenGrupos) {
    // bus donde el grupo entra completo dejando el menor espacio libre (mejor ajuste)
    const candidatos = Object.entries(libres).filter(([, l]) => l >= grupo.length).sort((a, b) => a[1] - b[1]);
    if (candidatos.length) {
      const [busId] = candidatos[0];
      grupo.forEach(p => cambios.push({ id: p.id, busId }));
      libres[busId] -= grupo.length;
      continue;
    }
    // no entra completo: repartir llenando los buses con más lugar
    for (const p of grupo) {
      const mejor = busConMasLugar();
      if (!mejor || mejor[1] <= 0) { sinLugar++; continue; }
      cambios.push({ id: p.id, busId: mejor[0] });
      libres[mejor[0]] -= 1;
    }
  }
  const resumen = {};
  cambios.forEach(c => { resumen[c.busId] = (resumen[c.busId] || 0) + 1; });
  return { cambios, resumen, sinLugar };
}

// ---------------- Itinerario ----------------
export function diaActivoDeItinerario(itinerario, hoy) {
  if (!itinerario.length) return null;
  const actual = itinerario.find(d => d.id === hoy);
  if (actual) return actual;
  const futuros = itinerario.filter(d => d.id > hoy);
  return futuros.length ? futuros[0] : itinerario[itinerario.length - 1];
}

// ---------------- Estados ----------------
export const ESTADOS_OPERATIVO = {
  planificacion: { label: 'Planificación', bg: '#FFF8E6', color: '#7A5200' },
  confirmado: { label: 'Confirmado', bg: '#E8F1FF', color: '#1554B0' },
  en_curso: { label: 'En curso', bg: '#E6FBF5', color: '#007A5A' },
  finalizado: { label: 'Finalizado', bg: '#F0F0F4', color: '#55556A' },
  cancelado: { label: 'Cancelado', bg: '#FFF1F0', color: '#CF1322' },
};
