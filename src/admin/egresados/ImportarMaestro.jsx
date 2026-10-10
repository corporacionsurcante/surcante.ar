import React, { useRef, useState } from 'react';
import { importarMaestro } from '../../firebase/egresadosService';
import { Modal } from './ui';
import { COLORES_BUS, leerArchivoPlanilla, limpiarDni, normalizarFecha, normalizarTexto } from './utils';

// ---- Mapa de sinónimos por tipo de hoja ----
const SIN_BUSES = {
  codigo:      ['codigo', 'identificacion', 'nombre bus', 'bus', 'omnibus', 'micro', 'coche'],
  capacidad:   ['capacidad', 'butacas', 'asientos'],
  color:       ['color', 'color identificacion'],
  empresa:     ['empresa', 'transportista'],
  interno:     ['interno', 'n interno', 'numero interno', 'int'],
  patente:     ['patente', 'matricula', 'dominio'],
  tipo:        ['tipo', 'descripcion', 'modelo'],
  puntoSalida: ['punto salida', 'lugar salida', 'salida propia'],
  presentacion:['presentacion', 'hora presentacion'],
  notas:       ['notas', 'observaciones'],
};

const SIN_STAFF = {
  apellido:    ['apellido', 'apellidos'],
  nombre:      ['nombre', 'nombres'],
  dni:         ['dni', 'documento', 'nro documento', 'numero documento', 'doc'],
  telefono:    ['telefono', 'tel', 'celular', 'cel', 'whatsapp'],
  email:       ['email', 'mail', 'correo'],
  bus:         ['omnibus', 'omnibus asignado', 'bus', 'micro', 'coche', 'unidad'],
  licencia:    ['licencia', 'nro licencia', 'numero licencia', 'lic'],
  vencLicencia:['vencimiento licencia', 'venc licencia', 'vencimiento'],
  grupo:       ['grupo', 'grupo colegio', 'colegio a cargo'],
  notas:       ['notas', 'observaciones'],
};

const SIN_PAX = {
  apellido:        ['apellido', 'apellidos'],
  nombre:          ['nombre', 'nombres'],
  dni:             ['dni', 'documento', 'nro documento', 'numero documento', 'doc'],
  tipoDoc:         ['tipo doc', 'tipo documento'],
  fechaNacimiento: ['fecha nac', 'fecha nacimiento', 'nacimiento', 'fnac'],
  sexo:            ['sexo', 'genero'],
  nacionalidad:    ['nac', 'nacionalidad', 'pais'],
  telefono:        ['telefono', 'tel', 'celular', 'cel'],
  email:           ['email', 'mail', 'correo'],
  colegio:         ['colegio', 'escuela', 'grupo', 'institucion'],
  hotel:           ['hotel', 'alojamiento'],
  habitacion:      ['habitacion', 'hab', 'room'],
  bus:             ['omnibus', 'bus', 'micro', 'coche', 'unidad'],
  asiento:         ['asiento', 'butaca', 'nro asiento'],
  coordinador:     ['coordinador', 'coordinadora', 'coord', 'responsable'],
  emergenciaNombre:['emerg nombre', 'contacto emergencia', 'tutor', 'emergencia nombre', 'nombre emergencia'],
  emergenciaTel:   ['emerg tel', 'tel emergencia', 'telefono emergencia', 'emergencia tel'],
  codigoAgencia:   ['codigo agencia', 'cod agencia', 'codigo', 'voucher', 'legajo'],
  observaciones:   ['observaciones', 'obs', 'notas'],
};

const SIN_ITIN = {
  fecha:             ['fecha', 'dia', 'date'],
  hora:              ['hora', 'horario'],
  titulo:            ['titulo', 'actividad', 'descripcion', 'nombre actividad'],
  paraPasajeros:     ['para pasajeros', 'pasajeros', 'descripcion pasajeros'],
  paraConductores:   ['para conductores', 'conductores', 'descripcion conductores'],
  paraCoordinadores: ['para coordinadores', 'coordinadores', 'descripcion coordinadores'],
  buses:             ['buses', 'omnibus asignados', 'para buses'],
  soloStaff:         ['solo staff', 'staff', 'interno'],
  resumen:           ['resumen', 'resumen del dia', 'resumen dia'],
  notasConductores:  ['notas conductores', 'notas para conductores'],
  notasCoordinadores:['notas coordinadores', 'notas para coordinadores'],
};

// ---- Helpers ----
function detectarCols(fila, mapa) {
  const usados = new Set();
  return fila.map(h => {
    const n = normalizarTexto(h);
    if (!n) return '';
    for (const [campo, sins] of Object.entries(mapa)) {
      if (usados.has(campo)) continue;
      if (sins.includes(n) || sins.some(s => s.length > 4 && n.includes(s))) {
        usados.add(campo);
        return campo;
      }
    }
    return '';
  });
}

function hallarEnc(filas, mapa) {
  let mejor = { idx: 0, cols: [], hits: -1 };
  filas.slice(0, 20).forEach((fila, idx) => {
    const cols = detectarCols(fila, mapa);
    const hits = cols.filter(Boolean).length;
    if (hits > mejor.hits) mejor = { idx, cols, hits };
  });
  return mejor;
}

const titulo_case = s => String(s || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p, l) => p + l.toUpperCase());

function normSexo(v) {
  const s = normalizarTexto(v);
  if (['m', 'masculino', 'masc', 'varon', 'hombre'].includes(s)) return 'M';
  if (['f', 'femenino', 'fem', 'mujer'].includes(s)) return 'F';
  return s ? 'X' : '';
}

function detectarHojas(nombres) {
  const tiene = (n, ...t) => t.some(x => normalizarTexto(n).includes(x));
  const buscar = (...t) => nombres.find(n => tiene(n, ...t)) || '';
  return {
    buses:         buscar('omnibus', 'buses', 'micro'),
    conductores:   buscar('conductor'),
    coordinadores: buscar('coordinador'),
    pasajeros:     buscar('pasajero', 'alumno', 'viajero'),
    itinerario:    buscar('itinerario', 'diagrama', 'programa', 'agenda'),
  };
}

// ---- Parsers ----
function parsearBuses(filas) {
  if (!filas?.length) return [];
  const { idx, cols } = hallarEnc(filas, SIN_BUSES);
  return filas.slice(idx + 1).reduce((acc, fila, i) => {
    const v = {};
    cols.forEach((c, j) => { if (c) v[c] = fila[j]; });
    const codigo = String(v.codigo || '').trim();
    if (!codigo) return acc;
    const colorN = normalizarTexto(v.color);
    const color = COLORES_BUS.find(c => normalizarTexto(c.label) === colorN || c.id === colorN)?.id
      || COLORES_BUS[(acc.length) % COLORES_BUS.length].id;
    acc.push({
      codigo,
      color,
      capacidad: Number(v.capacidad) || 60,
      empresa: String(v.empresa || 'SURCANTE').trim(),
      interno: String(v.interno || '').trim(),
      patente: String(v.patente || '').trim().toUpperCase(),
      tipo: String(v.tipo || '').trim(),
      puntoSalida: String(v.puntoSalida || '').trim(),
      presentacion: String(v.presentacion || '').trim(),
      notas: String(v.notas || '').trim(),
      orden: acc.length + 1,
      unidadId: null,
    });
    return acc;
  }, []);
}

function parsearStaff(filas, rol) {
  if (!filas?.length) return [];
  const { idx, cols } = hallarEnc(filas, SIN_STAFF);
  return filas.slice(idx + 1).reduce((acc, fila) => {
    const v = {};
    cols.forEach((c, j) => { if (c) v[c] = fila[j]; });
    const apellido = titulo_case(String(v.apellido || '').trim());
    const nombre = titulo_case(String(v.nombre || '').trim());
    if (!apellido && !nombre) return acc;
    const base = {
      rol, apellido, nombre,
      dni: limpiarDni(v.dni),
      telefono: String(v.telefono || '').trim(),
      email: String(v.email || '').trim().toLowerCase(),
      notas: String(v.notas || '').trim(),
      _busTexto: String(v.bus || '').trim(),
    };
    if (rol === 'conductor') {
      base.licencia = String(v.licencia || '').trim();
      base.vencLicencia = normalizarFecha(v.vencLicencia);
    } else {
      base.grupo = String(v.grupo || '').trim();
    }
    acc.push(base);
    return acc;
  }, []);
}

function parsearPasajeros(filas) {
  if (!filas?.length) return [];
  const { idx, cols } = hallarEnc(filas, SIN_PAX);
  return filas.slice(idx + 1).reduce((acc, fila) => {
    const v = {};
    cols.forEach((c, j) => { if (c) v[c] = fila[j]; });
    const apellido = titulo_case(String(v.apellido || '').trim());
    const nombre = titulo_case(String(v.nombre || '').trim());
    if (!apellido && !nombre) return acc;
    acc.push({
      apellido, nombre,
      dni: limpiarDni(v.dni),
      tipoDoc: String(v.tipoDoc || 'DNI').trim().toUpperCase() || 'DNI',
      fechaNacimiento: normalizarFecha(v.fechaNacimiento),
      sexo: normSexo(v.sexo),
      nacionalidad: titulo_case(String(v.nacionalidad || '').trim()) || 'Argentina',
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
      _busTexto: String(v.bus || '').trim(),
      _coordTexto: String(v.coordinador || '').trim(),
    });
    return acc;
  }, []);
}

function parsearItinerario(filas) {
  if (!filas?.length) return [];
  const { idx, cols } = hallarEnc(filas, SIN_ITIN);
  const porFecha = new Map();
  let ultimaFecha = '';
  filas.slice(idx + 1).forEach(fila => {
    const v = {};
    cols.forEach((c, j) => { if (c) v[c] = fila[j]; });
    const fecha = normalizarFecha(v.fecha) || ultimaFecha;
    if (!fecha) return;
    ultimaFecha = fecha;
    if (!porFecha.has(fecha)) porFecha.set(fecha, { actividades: [], resumen: '', notasConductores: '', notasCoordinadores: '' });
    const dia = porFecha.get(fecha);
    if (!dia.resumen && v.resumen) dia.resumen = String(v.resumen).trim();
    if (!dia.notasConductores && v.notasConductores) dia.notasConductores = String(v.notasConductores).trim();
    if (!dia.notasCoordinadores && v.notasCoordinadores) dia.notasCoordinadores = String(v.notasCoordinadores).trim();
    const titulo = String(v.titulo || '').trim();
    if (titulo || String(v.hora || '').trim()) {
      const ss = normalizarTexto(v.soloStaff);
      dia.actividades.push({
        hora: String(v.hora || '').trim(),
        titulo,
        paraPasajeros: String(v.paraPasajeros || '').trim(),
        paraConductores: String(v.paraConductores || '').trim(),
        paraCoordinadores: String(v.paraCoordinadores || '').trim(),
        _busesTexto: String(v.buses || '').trim(),
        soloStaff: ['s', 'si', 'sí', 'yes', '1', 'x'].includes(ss),
      });
    }
  });
  return [...porFecha.entries()].map(([fecha, d]) => ({ fecha, ...d }));
}

// ---- Componente ----
export default function ImportarMaestro({ opId, buses, staff, pasajeros, onClose }) {
  const [paso, setPaso] = useState('archivo');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [tabPrev, setTabPrev] = useState('buses');
  const inputRef = useRef(null);

  async function abrirArchivo(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera 10 MB. Reducí el tamaño antes de importar.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const lb = await leerArchivoPlanilla(file);
      const hojas = detectarHojas(lb.hojas);
      const leer = h => (h ? lb.leer(h) : []);
      const d = {
        hojas,
        buses:         parsearBuses(leer(hojas.buses)),
        conductores:   parsearStaff(leer(hojas.conductores), 'conductor'),
        coordinadores: parsearStaff(leer(hojas.coordinadores), 'coordinador'),
        pasajeros:     parsearPasajeros(leer(hojas.pasajeros)),
        itinerario:    parsearItinerario(leer(hojas.itinerario)),
      };
      setDatos(d);
      setPaso('preview');
      const primera = ['buses', 'conductores', 'coordinadores', 'pasajeros', 'itinerario'].find(k => d[k]?.length > 0);
      if (primera) setTabPrev(primera);
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo leer el archivo.');
    }
    setCargando(false);
  }

  async function ejecutarImport() {
    setImportando(true);
    setError('');
    try {
      await importarMaestro(opId, datos, { buses, pasajeros });
      onClose?.();
    } catch (e) {
      console.error(e);
      setError('Error al importar. Revisá la conexión y volvé a intentar.');
      setImportando(false);
    }
  }

  const totalRegistros = datos
    ? datos.buses.length + datos.conductores.length + datos.coordinadores.length + datos.pasajeros.length + datos.itinerario.length
    : 0;

  const todosBuses = datos ? [...buses, ...datos.buses] : buses;

  const TABS = [
    { k: 'buses', icon: '🚌', label: 'Ómnibus' },
    { k: 'conductores', icon: '🧑‍✈️', label: 'Conductores' },
    { k: 'coordinadores', icon: '📋', label: 'Coordinadores' },
    { k: 'pasajeros', icon: '🎒', label: 'Pasajeros' },
    { k: 'itinerario', icon: '🗓️', label: 'Itinerario' },
  ];

  return (
    <Modal
      wide
      titulo="Importar desde Excel Maestro"
      onClose={onClose}
      footer={paso === 'preview' ? (
        <>
          <button className="eg-btn eg-btn-ghost" onClick={() => { setPaso('archivo'); setDatos(null); }}>← Otro archivo</button>
          <button
            className="eg-btn eg-btn-primary"
            onClick={ejecutarImport}
            disabled={importando || totalRegistros === 0}>
            {importando ? 'Importando...' : `✓ Importar (${totalRegistros} registros)`}
          </button>
        </>
      ) : null}>

      {paso === 'archivo' && (
        <div
          className={`eg-drop ${drag ? 'drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); abrirArchivo(e.dataTransfer.files?.[0]); }}>
          <div style={{ fontSize: 36 }}>📊</div>
          <div style={{ fontWeight: 800, marginTop: 8 }}>
            {cargando ? 'Leyendo archivo...' : 'Subí el Excel Maestro de Surcante'}
          </div>
          <div className="eg-sub">Arrastrá el archivo .xlsx o tocá para elegirlo.</div>
          <div className="eg-sub" style={{ marginTop: 4 }}>
            Detectamos automáticamente las hojas: Ómnibus, Conductores, Coordinadores, Pasajeros e Itinerario.
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { abrirArchivo(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
      )}

      {paso === 'preview' && datos && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {TABS.map(({ k, icon, label }) => (
              <button
                key={k}
                className={`eg-btn eg-btn-sm ${tabPrev === k ? 'eg-btn-primary' : 'eg-btn-ghost'}`}
                onClick={() => setTabPrev(k)}>
                {icon} {label} ({datos[k].length})
              </button>
            ))}
          </div>

          {tabPrev === 'buses' && (
            <PrevBuses lista={datos.buses} existentes={buses} />
          )}
          {tabPrev === 'conductores' && (
            <PrevStaff lista={datos.conductores} buses={todosBuses} />
          )}
          {tabPrev === 'coordinadores' && (
            <PrevStaff lista={datos.coordinadores} buses={todosBuses} />
          )}
          {tabPrev === 'pasajeros' && (
            <PrevPasajeros lista={datos.pasajeros} buses={todosBuses} paxExistentes={pasajeros} />
          )}
          {tabPrev === 'itinerario' && (
            <PrevItinerario lista={datos.itinerario} />
          )}

          {totalRegistros === 0 && (
            <div className="eg-alert eg-alert-warn">
              No se encontraron datos en el archivo. Verificá que sea el Excel Maestro correcto con las hojas nombradas (Ómnibus, Conductores, etc.).
            </div>
          )}
        </>
      )}

      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

// ---- Subvistas de preview ----

function PrevBuses({ lista, existentes }) {
  const codsExistentes = new Set(existentes.map(b => normalizarTexto(b.codigo)));
  if (!lista.length) return <p className="eg-sub">No se encontraron ómnibus en el archivo.</p>;
  return (
    <div className="eg-table-wrap" style={{ maxHeight: 300 }}>
      <table className="eg-table">
        <thead>
          <tr><th>Código</th><th>Color</th><th>Cap.</th><th>Empresa</th><th>Patente</th><th></th></tr>
        </thead>
        <tbody>
          {lista.map((b, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 700 }}>{b.codigo}</td>
              <td>
                <span className="eg-chip" style={{ background: COLORES_BUS.find(c => c.id === b.color)?.hex || '#999', color: '#fff' }}>
                  {b.color}
                </span>
              </td>
              <td>{b.capacidad}</td>
              <td className="muted">{b.empresa || '—'}</td>
              <td className="muted">{b.patente || '—'}</td>
              <td>
                {codsExistentes.has(normalizarTexto(b.codigo))
                  ? <span className="eg-chip eg-chip-amber">ya existe</span>
                  : <span className="eg-chip eg-chip-green">nuevo</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrevStaff({ lista, buses }) {
  const encontrar = t => buses.find(b => normalizarTexto(b.codigo) === normalizarTexto(t));
  if (!lista.length) return <p className="eg-sub">No se encontraron registros en el archivo.</p>;
  return (
    <div className="eg-table-wrap" style={{ maxHeight: 300 }}>
      <table className="eg-table">
        <thead>
          <tr><th>Nombre</th><th>DNI</th><th>Teléfono</th><th>Ómnibus</th></tr>
        </thead>
        <tbody>
          {lista.map((p, i) => {
            const bus = p._busTexto ? encontrar(p._busTexto) : null;
            return (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{p.apellido}, {p.nombre}</td>
                <td className="muted">{p.dni || '—'}</td>
                <td className="muted">{p.telefono || '—'}</td>
                <td>
                  {p._busTexto
                    ? (bus ? bus.codigo : <span className="eg-chip eg-chip-amber">⚠️ {p._busTexto}</span>)
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrevPasajeros({ lista, buses, paxExistentes }) {
  const porDni = new Map(paxExistentes.filter(p => p.dni).map(p => [p.dni, true]));
  const encontrar = t => buses.find(b => normalizarTexto(b.codigo) === normalizarTexto(t));
  const sinBus = lista.filter(p => p._busTexto && !encontrar(p._busTexto)).length;
  if (!lista.length) return <p className="eg-sub">No se encontraron pasajeros en el archivo.</p>;
  return (
    <>
      {sinBus > 0 && (
        <div className="eg-alert eg-alert-warn" style={{ marginBottom: 10 }}>
          ⚠️ {sinBus} pasajero(s) hacen referencia a un ómnibus que no se encontró. Quedan sin asignar.
        </div>
      )}
      <div className="eg-table-wrap" style={{ maxHeight: 280 }}>
        <table className="eg-table">
          <thead>
            <tr><th>Pasajero</th><th>DNI</th><th>Colegio</th><th>Hotel</th><th>Ómnibus</th><th></th></tr>
          </thead>
          <tbody>
            {lista.slice(0, 20).map((p, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{p.apellido}, {p.nombre}</td>
                <td className="muted">{p.dni || '—'}</td>
                <td className="muted">{p.colegio || '—'}</td>
                <td className="muted">{p.hotel || '—'}</td>
                <td className="muted">{p._busTexto || '—'}</td>
                <td>
                  {p.dni && porDni.has(p.dni)
                    ? <span className="eg-chip eg-chip-amber">actualiza</span>
                    : <span className="eg-chip eg-chip-green">nuevo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lista.length > 20 && <div className="eg-sub" style={{ marginTop: 6 }}>…y {lista.length - 20} más.</div>}
    </>
  );
}

function PrevItinerario({ lista }) {
  if (!lista.length) return <p className="eg-sub">No se encontró itinerario en el archivo.</p>;
  return (
    <div className="eg-table-wrap" style={{ maxHeight: 300 }}>
      <table className="eg-table">
        <thead>
          <tr><th>Fecha</th><th>Actividades</th><th>Resumen</th></tr>
        </thead>
        <tbody>
          {lista.map((d, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 700 }}>{d.fecha}</td>
              <td>{d.actividades.length} actividad{d.actividades.length !== 1 ? 'es' : ''}</td>
              <td className="muted">
                {d.resumen ? `${d.resumen.slice(0, 70)}${d.resumen.length > 70 ? '…' : ''}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
