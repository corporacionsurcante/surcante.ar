import React, { useMemo, useRef, useState } from 'react';
import { guardarPasajerosMasivo } from '../../firebase/egresadosService';
import { Modal, BusChip } from './ui';
import {
  CAMPOS_PASAJERO, detectarEncabezados, filasAPasajeros, leerArchivoPlanilla, parsearTexto, apellidoNombre,
} from './utils';

// Importa pasajeros desde Excel (.xlsx/.xls), CSV o texto pegado desde Excel.
export default function ImportarPasajeros({ opId, buses, staff, pasajeros, onClose, onListo }) {
  const [paso, setPaso] = useState('origen'); // origen | mapeo
  const [libro, setLibro] = useState(null); // { hojas, leer }
  const [hoja, setHoja] = useState('');
  const [filas, setFilas] = useState([]);
  const [idxEnc, setIdxEnc] = useState(0);
  const [mapeo, setMapeo] = useState([]);
  const [texto, setTexto] = useState('');
  const [modoDuplicado, setModoDuplicado] = useState('actualizar'); // actualizar | omitir
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  function prepararFilas(f) {
    const limpias = f.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''));
    if (limpias.length < 2) { setError('No encontramos datos: la planilla necesita una fila de títulos y al menos un pasajero.'); return; }
    const det = detectarEncabezados(limpias);
    setFilas(limpias);
    setIdxEnc(det.idx);
    setMapeo(ajustarLargo(det.mapeo, limpias[det.idx].length));
    setError('');
    setPaso('mapeo');
  }

  async function abrirArchivo(file) {
    if (!file) return;
    setCargando(true);
    setError('');
    try {
      const lb = await leerArchivoPlanilla(file);
      setLibro(lb);
      setHoja(lb.hojas[0]);
      prepararFilas(lb.leer(lb.hojas[0]));
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo leer el archivo.');
    }
    setCargando(false);
  }

  function cambiarHoja(h) {
    setHoja(h);
    prepararFilas(libro.leer(h));
  }

  function usarTexto() {
    if (!texto.trim()) { setError('Pegá los datos copiados del Excel (incluyendo la fila de títulos).'); return; }
    prepararFilas(parsearTexto(texto));
  }

  function cambiarEncabezado(i) {
    setIdxEnc(i);
    const det = detectarEncabezados([filas[i]]);
    setMapeo(ajustarLargo(det.mapeo, filas[i].length));
  }

  function cambiarMapeo(col, campo) {
    setMapeo(prev => prev.map((m, i) => {
      if (i === col) return campo;
      return campo && m === campo ? '' : m; // cada campo en una sola columna
    }));
  }

  const nuevos = useMemo(
    () => (paso === 'mapeo' ? filasAPasajeros(filas, idxEnc, mapeo, buses, staff) : []),
    [paso, filas, idxEnc, mapeo, buses, staff],
  );

  const analisis = useMemo(() => {
    const porDni = new Map(pasajeros.filter(p => p.dni).map(p => [p.dni, p]));
    let actualizan = 0; let omitidos = 0; let dupInternos = 0;
    const vistos = new Set();
    const lista = [];
    nuevos.forEach(p => {
      if (p.dni && vistos.has(p.dni)) { dupInternos++; return; }
      if (p.dni) vistos.add(p.dni);
      const existente = p.dni ? porDni.get(p.dni) : null;
      if (existente) {
        if (modoDuplicado === 'omitir') { omitidos++; return; }
        actualizan++;
        lista.push({ ...p, id: existente.id, _existe: true });
      } else {
        lista.push(p);
      }
    });
    const busNoEncontrado = [...new Set(nuevos.filter(p => p._busTexto && !p.busId).map(p => p._busTexto))];
    const coordNoEncontrado = [...new Set(nuevos.filter(p => p._coordTexto && !p.coordinadorId).map(p => p._coordTexto))];
    const sinDni = nuevos.filter(p => !p.dni).length;
    return { lista, actualizan, omitidos, dupInternos, busNoEncontrado, coordNoEncontrado, sinDni };
  }, [nuevos, pasajeros, modoDuplicado]);

  async function importar() {
    setCargando(true);
    setError('');
    try {
      const datos = analisis.lista.map(({ _busTexto, _coordTexto, _existe, ...p }) => {
        if (!_existe) return p;
        // al actualizar no pisar asignaciones existentes con vacíos
        const limpio = { ...p };
        Object.keys(limpio).forEach(k => { if (k !== 'id' && (limpio[k] === '' || limpio[k] === null)) delete limpio[k]; });
        return limpio;
      });
      await guardarPasajerosMasivo(opId, datos);
      onListo?.(datos.length);
      onClose();
    } catch (e) {
      console.error(e);
      setError('Error guardando en Firestore. No se importó todo: revisá y volvé a intentar (los DNI ya cargados se actualizan, no se duplican).');
      setCargando(false);
    }
  }

  const tieneNombre = mapeo.some(m => ['apellido', 'nombre', 'apellidoNombre', 'nombreApellido'].includes(m));

  return (
    <Modal
      wide
      titulo="Importar pasajeros"
      onClose={onClose}
      footer={paso === 'mapeo' ? <>
        <button className="eg-btn eg-btn-ghost" onClick={() => { setPaso('origen'); setLibro(null); }}>← Otro archivo</button>
        <button className="eg-btn eg-btn-primary" onClick={importar} disabled={cargando || !tieneNombre || !analisis.lista.length}>
          {cargando ? 'Importando...' : `✓ Importar ${analisis.lista.length} pasajeros`}
        </button>
      </> : null}>

      {paso === 'origen' && (
        <>
          <div
            className={`eg-drop ${drag ? 'drag' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); abrirArchivo(e.dataTransfer.files?.[0]); }}>
            <div style={{ fontSize: 34 }}>📥</div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>{cargando ? 'Leyendo archivo...' : 'Arrastrá el Excel de la agencia o tocá para elegirlo'}</div>
            <div className="eg-sub">.xlsx · .xls · .csv — detectamos las columnas automáticamente</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt,.tsv,.ods" style={{ display: 'none' }}
              onChange={e => { abrirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div style={{ textAlign: 'center', margin: '14px 0', fontSize: 12, color: '#9090B0', fontWeight: 700 }}>— o —</div>
          <div className="eg-field">
            <label>Pegá las celdas copiadas del Excel (con la fila de títulos)</label>
            <textarea rows={6} value={texto} onChange={e => setTexto(e.target.value)} placeholder={'Apellido\tNombre\tDNI\tColegio\tHotel\nPérez\tJuan\t45123456\tEsc. N°53\tHotel Sol'} />
          </div>
          <button className="eg-btn eg-btn-soft" style={{ marginTop: 10 }} onClick={usarTexto}>Continuar con el texto pegado →</button>
        </>
      )}

      {paso === 'mapeo' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {libro?.hojas?.length > 1 && (
              <div className="eg-field" style={{ minWidth: 180 }}>
                <label>Hoja</label>
                <select value={hoja} onChange={e => cambiarHoja(e.target.value)}>
                  {libro.hojas.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            )}
            <div className="eg-field" style={{ minWidth: 220 }}>
              <label>Fila de títulos</label>
              <select value={idxEnc} onChange={e => cambiarEncabezado(Number(e.target.value))}>
                {filas.slice(0, 15).map((f, i) => (
                  <option key={i} value={i}>Fila {i + 1}: {f.filter(Boolean).slice(0, 4).join(' | ').slice(0, 60)}</option>
                ))}
              </select>
            </div>
            <div className="eg-field" style={{ minWidth: 220 }}>
              <label>Si el DNI ya está cargado</label>
              <select value={modoDuplicado} onChange={e => setModoDuplicado(e.target.value)}>
                <option value="actualizar">Actualizar sus datos</option>
                <option value="omitir">Dejarlo como está</option>
              </select>
            </div>
          </div>

          <div className="eg-section-title" style={{ fontSize: 12 }}>Columnas detectadas — corregí las que hagan falta</div>
          <div className="eg-map-grid" style={{ marginBottom: 14 }}>
            {(filas[idxEnc] || []).map((h, i) => (
              <div key={i} className={`eg-map-item ${mapeo[i] ? 'ok' : ''}`}>
                <div className="col" title={String(h)}>{String(h || `Columna ${i + 1}`)}</div>
                <select value={mapeo[i] || ''} onChange={e => cambiarMapeo(i, e.target.value)}>
                  <option value="">— No importar —</option>
                  {CAMPOS_PASAJERO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          {!tieneNombre && <div className="eg-alert eg-alert-error">⛔ Indicá qué columna tiene el nombre y apellido.</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="eg-chip eg-chip-purple">{nuevos.length} filas leídas</span>
            <span className="eg-chip eg-chip-green">{analisis.lista.length - analisis.actualizan} nuevos</span>
            {analisis.actualizan > 0 && <span className="eg-chip">{analisis.actualizan} se actualizan (DNI existente)</span>}
            {analisis.omitidos > 0 && <span className="eg-chip">{analisis.omitidos} se omiten (DNI existente)</span>}
            {analisis.dupInternos > 0 && <span className="eg-chip eg-chip-red">{analisis.dupInternos} DNI repetidos en el archivo (se toma el primero)</span>}
            {analisis.sinDni > 0 && <span className="eg-chip eg-chip-amber">{analisis.sinDni} sin DNI</span>}
          </div>
          {analisis.busNoEncontrado.length > 0 && (
            <div className="eg-alert eg-alert-warn">⚠️ Ómnibus del Excel que no existen en el operativo: <b>{analisis.busNoEncontrado.slice(0, 8).join(', ')}</b>. Esos pasajeros quedan sin asignar (podés crear los ómnibus antes y volver a importar).</div>
          )}
          {analisis.coordNoEncontrado.length > 0 && (
            <div className="eg-alert eg-alert-warn">⚠️ Coordinadores no encontrados: <b>{analisis.coordNoEncontrado.slice(0, 8).join(', ')}</b>. Cargalos en "Conductores y coordinadores" para vincularlos.</div>
          )}

          <div className="eg-table-wrap" style={{ maxHeight: 300 }}>
            <table className="eg-table">
              <thead><tr><th>Pasajero</th><th>DNI</th><th>Nac.</th><th>Colegio</th><th>Hotel</th><th>Ómnibus</th><th>Teléfono</th><th>Emergencia</th></tr></thead>
              <tbody>
                {analisis.lista.slice(0, 12).map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{apellidoNombre(p)} {p._existe && <span className="eg-chip">actualiza</span>}</td>
                    <td>{p.dni || <span className="eg-chip eg-chip-amber">—</span>}</td>
                    <td className="muted">{p.fechaNacimiento || '—'}</td>
                    <td className="muted">{p.colegio || '—'}</td>
                    <td className="muted">{[p.hotel, p.habitacion].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{p.busId ? <BusChip bus={buses.find(b => b.id === p.busId)} /> : <span className="muted">{p._busTexto || '—'}</span>}</td>
                    <td className="muted">{p.telefono || '—'}</td>
                    <td className="muted">{[p.emergenciaNombre, p.emergenciaTel].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analisis.lista.length > 12 && <div className="eg-sub" style={{ marginTop: 6 }}>…y {analisis.lista.length - 12} más.</div>}
        </>
      )}

      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

function ajustarLargo(mapeo, largo) {
  const m = mapeo.slice(0, largo);
  while (m.length < largo) m.push('');
  return m;
}
