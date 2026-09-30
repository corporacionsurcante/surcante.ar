import React, { useState, useEffect, useRef, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { suscribirUnidades, suscribirViajes, agregarViaje, actualizarViaje, eliminarViaje, inicializarUnidades } from '../../firebase/ganttServices';
import { mapaCeldas, validarViaje, superposiciones } from '../../utils/ocupacion';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const COLORES = ['#00BCD4','#FF9800','#E91E63','#4CAF50','#9C27B0','#F44336','#2196F3','#FF5722','#009688','#FFC107','#3F51B5','#8BC34A'];
const TIPO_COLOR = { 'MIX 60': '#4A0FA8', 'Comun 45': '#1565C0', 'Minibus 24': '#00796B', 'Minibus 19': '#558B2F' };

function diasEnMes(mes, anio) {
  return new Date(anio, mes + 1, 0).getDate();
}

function getUserLabel(email) {
  if (!email) return '?';
  if (email.includes('traveldance') || email.includes('bournissen') || email.toLowerCase().includes('jose')) return 'JB';
  if (email.includes('machado') || email.includes('sebastian')) return 'SM';
  return email.slice(0, 2).toUpperCase();
}

function getUserColor(email) {
  if (!email) return '#999';
  if (email.includes('traveldance') || email.includes('bournissen') || email.toLowerCase().includes('jose')) return '#7B2FBE';
  if (email.includes('machado') || email.includes('sebastian')) return '#1565C0';
  return '#555';
}

function fechaCorta(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function mensajeError(e) {
  return e?.code === 'permission-denied'
    ? 'Firestore no permite leer/guardar el diagrama. Hay que publicar las reglas actualizadas (firestore.rules del repositorio) en Firebase Console → Firestore → Reglas.'
    : 'No se pudo conectar con la base de datos. Revisá la conexión y recargá.';
}

const lbl = { fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 };
const inp = { width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff' };

export default function Gantt() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [unidades, setUnidades] = useState([]);
  const [viajesAnio, setViajesAnio] = useState([]);
  const [viajesAnterior, setViajesAnterior] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ destino: '', desde: '', turnoSalida: 'M', hasta: '', turnoRegreso: 'T', color: COLORES[0], notas: '' });
  const [errorForm, setErrorForm] = useState('');
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => onAuthStateChanged(auth, u => setCurrentUser(u)), []);

  useEffect(() => suscribirUnidades(
    data => { setUnidades(data); setLoading(false); },
    e => { setErrorCarga(mensajeError(e)); setLoading(false); },
  ), []);

  // Viajes del año visible + los del año anterior (los que salen en diciembre y
  // terminan en enero se guardan en la colección del año de salida)
  useEffect(() => {
    const onError = e => setErrorCarga(mensajeError(e));
    const u1 = suscribirViajes(anio, v => { setViajesAnio(v); setErrorCarga(''); }, onError);
    const u2 = suscribirViajes(anio - 1, setViajesAnterior, onError);
    return () => { u1(); u2(); };
  }, [anio]);

  const viajes = useMemo(() => [...viajesAnterior, ...viajesAnio], [viajesAnterior, viajesAnio]);
  const celdas = useMemo(() => mapaCeldas(viajes), [viajes]);

  // Pantalla completa
  function toggleFullscreen() {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) setFullscreen(false);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function mesAnterior() {
    if (mesActual === 0) { setMesActual(11); setAnio(a => a - 1); } else setMesActual(m => m - 1);
  }
  function mesSiguiente() {
    if (mesActual === 11) { setMesActual(0); setAnio(a => a + 1); } else setMesActual(m => m + 1);
  }

  function abrirNuevo(unidadId, fecha, turno) {
    setForm({ destino: '', desde: fecha, turnoSalida: turno, hasta: fecha, turnoRegreso: 'T', color: COLORES[Math.floor(Math.random() * COLORES.length)], notas: '' });
    setErrorForm('');
    setConfirmarBorrar(false);
    setModal({ tipo: 'nuevo', unidadId });
  }

  function abrirEditar(viaje) {
    setForm({ destino: viaje.destino || '', desde: viaje.desde, turnoSalida: viaje.turnoSalida || 'M', hasta: viaje.hasta, turnoRegreso: viaje.turnoRegreso || 'T', color: viaje.color || COLORES[0], notas: viaje.notas || '' });
    setErrorForm('');
    setConfirmarBorrar(false);
    setModal({ tipo: 'editar', viaje });
  }

  async function handleGuardar() {
    if (!form.destino.trim()) { setErrorForm('Poné el destino del viaje.'); return; }
    const errorFechas = validarViaje(form);
    if (errorFechas) { setErrorForm(errorFechas); return; }

    const unidadId = modal.tipo === 'nuevo' ? modal.unidadId : modal.viaje.unidadId;
    const candidato = { ...form, unidadId, id: modal.viaje?.id };
    const choques = superposiciones(candidato, viajes);
    if (choques.length) {
      setErrorForm(`La unidad ya tiene ${choques.length === 1 ? 'un viaje' : 'viajes'} en esas fechas: ${choques.map(v => `${v.destino} (${fechaCorta(v.desde)} → ${fechaCorta(v.hasta)})`).join(', ')}.`);
      return;
    }

    setSaving(true);
    setErrorForm('');
    try {
      const datos = {
        destino: form.destino.trim(),
        desde: form.desde,
        hasta: form.hasta,
        turnoSalida: form.turnoSalida,
        turnoRegreso: form.turnoRegreso,
        color: form.color,
        notas: form.notas.trim(),
        cargadoPor: currentUser?.email || 'desconocido',
      };
      if (modal.tipo === 'nuevo') {
        await agregarViaje({ ...datos, unidadId });
      } else {
        await actualizarViaje(modal.viaje, datos);
      }
      setModal(null);
    } catch (e) {
      console.error(e);
      setErrorForm(mensajeError(e));
    }
    setSaving(false);
  }

  async function handleEliminar() {
    if (!modal?.viaje?.id) return;
    setSaving(true);
    try {
      await eliminarViaje(modal.viaje);
      setModal(null);
    } catch (e) {
      console.error(e);
      setErrorForm(mensajeError(e));
    }
    setSaving(false);
  }

  const diasMes = diasEnMes(mesActual, anio);

  if (loading) return <div className="admin-loading">Cargando Gantt...</div>;

  if (unidades.length === 0) return (
    <div className="admin-empty">
      <div className="admin-empty-icon">🚌</div>
      {errorCarga
        ? <div style={{ color: '#CF1322', marginBottom: 16 }}>{errorCarga}</div>
        : <div style={{ marginBottom: 16 }}>No hay unidades cargadas.</div>}
      {!errorCarga && <button className="section-action" onClick={inicializarUnidades}>Inicializar unidades Surcante</button>}
    </div>
  );

  const navBtn = { width: 32, height: 32, borderRadius: '50%', border: '1px solid #EDE8F8', background: '#fff', cursor: 'pointer', fontSize: 18, color: '#333' };

  return (
    <div ref={containerRef} style={{
      background: '#fff',
      padding: fullscreen ? 16 : 0,
      height: fullscreen ? '100vh' : 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {errorCarga && (
        <div style={{ background: '#FFF1F0', color: '#A8071A', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
          ⛔ {errorCarga}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={mesAnterior} style={navBtn} aria-label="Mes anterior">‹</button>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#0A0A0F', minWidth: 200, textAlign: 'center' }}>
            {MESES[mesActual]} {anio}
          </span>
          <button onClick={mesSiguiente} style={navBtn} aria-label="Mes siguiente">›</button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setAnio(a => a - 1)} style={{ ...navBtn, width: 'auto', borderRadius: 20, padding: '0 10px', fontSize: 11, fontWeight: 700 }}>‹ {anio - 1}</button>
          {MESES.map((m, i) => (
            <button key={i} onClick={() => setMesActual(i)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                borderColor: mesActual === i ? '#7B2FBE' : '#EDE8F8',
                background: mesActual === i ? '#7B2FBE' : 'transparent',
                color: mesActual === i ? '#fff' : '#4A4A6A',
                fontFamily: 'Inter, sans-serif',
              }}>{m.slice(0, 3)}</button>
          ))}
          <button onClick={() => setAnio(a => a + 1)} style={{ ...navBtn, width: 'auto', borderRadius: 20, padding: '0 10px', fontSize: 11, fontWeight: 700 }}>{anio + 1} ›</button>
          <button onClick={toggleFullscreen}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', border: '1px solid #7B2FBE',
              background: fullscreen ? '#7B2FBE' : 'transparent',
              color: fullscreen ? '#fff' : '#7B2FBE',
              fontFamily: 'Inter, sans-serif', marginLeft: 4,
            }}>
            {fullscreen ? '✕ Salir' : '⛶ Pantalla completa'}
          </button>
        </div>
      </div>

      {/* Leyenda usuarios */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {[...new Set(viajes.map(v => v.cargadoPor).filter(Boolean))].map(email => (
          <div key={email} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: getUserColor(email), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
              {getUserLabel(email)}
            </span>
            {email}
          </div>
        ))}
      </div>

      {/* Tabla Gantt */}
      <div style={{ overflowX: 'auto', flex: 1, borderRadius: 10, border: '1px solid #EDE8F8' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{
                padding: '8px 12px', background: '#0A0A0F', color: '#fff',
                fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase',
                minWidth: 150, position: 'sticky', left: 0, zIndex: 3,
                borderRight: '2px solid #7B2FBE',
              }}>Unidad</th>
              {Array.from({ length: diasMes }, (_, i) => {
                const dow = new Date(anio, mesActual, i + 1).getDay();
                const esFinde = dow === 0 || dow === 6;
                return (
                  <th key={i} colSpan={2} style={{
                    padding: '4px 2px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                    background: esFinde ? '#1a1a2e' : '#0A0A0F',
                    color: esFinde ? '#C4B5F8' : '#9090B0',
                    borderRight: '1px solid #1E1E2E', minWidth: 28,
                  }}>{i + 1}</th>
                );
              })}
            </tr>
            <tr>
              {Array.from({ length: diasMes }, (_, i) => (
                <React.Fragment key={i}>
                  <th style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 600, background: '#141420', color: '#555', width: 14, borderRight: '1px solid #1E1E2E' }}>M</th>
                  <th style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 600, background: '#141420', color: '#555', width: 14, borderRight: '1px solid #2A2A3E' }}>T</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {unidades.map((u, uidx) => (
              <tr key={u.id} style={{ background: uidx % 2 === 0 ? '#fff' : '#FAF8FF', opacity: u.activa === false ? 0.55 : 1 }}>
                <td style={{
                  padding: '6px 12px', fontWeight: 600, fontSize: 11,
                  background: uidx % 2 === 0 ? '#fff' : '#FAF8FF',
                  position: 'sticky', left: 0, zIndex: 2,
                  borderRight: '2px solid #7B2FBE', borderBottom: '1px solid #F0EDF8',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 800,
                      background: TIPO_COLOR[u.tipo] || '#4A0FA8', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{u.interno}</span>
                    <div>
                      <div style={{ color: '#0A0A0F', fontWeight: 700 }}>{u.patente}</div>
                      <div style={{ color: '#9090B0', fontSize: 10 }}>{u.tipo}{u.activa === false ? ' · inactiva' : ''}</div>
                    </div>
                  </div>
                </td>
                {Array.from({ length: diasMes }, (_, di) => {
                  const fecha = `${anio}-${String(mesActual + 1).padStart(2, '0')}-${String(di + 1).padStart(2, '0')}`;
                  return ['M', 'T'].map(turno => {
                    const viaje = celdas[`${u.id}_${fecha}_${turno}`];
                    // La etiqueta va en la primera celda visible del viaje
                    const esInicio = viaje && (fecha === viaje.desde
                      ? turno === (viaje.turnoSalida || 'M')
                      : di === 0 && turno === 'M');
                    const userLabel = viaje?.cargadoPor ? getUserLabel(viaje.cargadoPor) : null;
                    return (
                      <td key={`${di}_${turno}`}
                        onClick={() => viaje ? abrirEditar(viaje) : abrirNuevo(u.id, fecha, turno)}
                        style={{
                          width: 14, height: 32, padding: 0, cursor: 'pointer',
                          background: viaje ? viaje.color : 'transparent',
                          borderRight: turno === 'T' ? '1px solid #F0EDF8' : '1px solid #F8F6FF',
                          borderBottom: '1px solid #F0EDF8',
                          position: 'relative',
                        }}
                        title={viaje ? `${viaje.destino} · ${fechaCorta(viaje.desde)} → ${fechaCorta(viaje.hasta)} · Cargado por: ${viaje.cargadoPor || 'desconocido'}` : `${fechaCorta(fecha)} ${turno === 'M' ? 'mañana' : 'tarde'}`}>
                        {esInicio && (
                          <div style={{ position: 'absolute', left: 1, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
                            <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60, textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
                              {viaje.destino}
                            </span>
                            {userLabel && (
                              <span style={{ fontSize: 7, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>
                                {userLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda tipos */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(TIPO_COLOR).map(([tipo, color]) => (
          <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4A4A6A', fontWeight: 500 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: 'inline-block' }} />
            {tipo}
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#9090B0', marginLeft: 'auto' }}>
          Click en celda vacía para asignar · Click en viaje para editar · Lo que cargues acá bloquea la unidad en el cotizador
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20,
        }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0A0A0F' }}>
                {modal.tipo === 'nuevo' ? '+ Nuevo viaje' : '✏️ Editar viaje'}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9090B0' }}>✕</button>
            </div>

            {(() => {
              const u = unidades.find(x => x.id === (modal.tipo === 'nuevo' ? modal.unidadId : modal.viaje.unidadId));
              return u ? (
                <div style={{ fontSize: 12, color: '#4A4A6A', fontWeight: 600, marginBottom: 12 }}>
                  🚌 Interno {u.interno} · {u.patente} · {u.tipo}
                </div>
              ) : null;
            })()}

            {modal.tipo === 'editar' && modal.viaje.cargadoPor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '6px 10px', background: '#F4F2FA', borderRadius: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: getUserColor(modal.viaje.cargadoPor), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                  {getUserLabel(modal.viaje.cargadoPor)}
                </span>
                <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Cargado por {modal.viaje.cargadoPor}</span>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Destino</label>
              <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                placeholder="ej: Mar del Plata" style={inp} autoFocus />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Salida</label>
                <input type="date" value={form.desde} onChange={e => setForm(f => ({ ...f, desde: e.target.value, hasta: f.hasta && f.hasta < e.target.value ? e.target.value : f.hasta }))}
                  style={{ ...inp, padding: '9px 10px', fontSize: 13 }} />
              </div>
              <div>
                <label style={lbl}>Turno salida</label>
                <select value={form.turnoSalida} onChange={e => setForm(f => ({ ...f, turnoSalida: e.target.value }))} style={{ ...inp, padding: '9px 10px' }}>
                  <option value="M">🌅 Mañana</option>
                  <option value="T">🌆 Tarde</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Regreso</label>
                <input type="date" value={form.hasta} min={form.desde || undefined} onChange={e => setForm(f => ({ ...f, hasta: e.target.value }))}
                  style={{ ...inp, padding: '9px 10px', fontSize: 13 }} />
              </div>
              <div>
                <label style={lbl}>Turno regreso</label>
                <select value={form.turnoRegreso} onChange={e => setForm(f => ({ ...f, turnoRegreso: e.target.value }))} style={{ ...inp, padding: '9px 10px' }}>
                  <option value="M">🌅 Mañana</option>
                  <option value="T">🌆 Tarde</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ ...lbl, marginBottom: 8 }}>Color del viaje</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORES.map(col => (
                  <div key={col} onClick={() => setForm(f => ({ ...f, color: col }))}
                    style={{ width: 28, height: 28, borderRadius: 6, background: col, cursor: 'pointer', border: form.color === col ? '3px solid #0A0A0F' : '2px solid transparent', transition: 'border .1s' }} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Notas</label>
              <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="ej: Contacto, precio acordado..." style={{ ...inp, fontSize: 13 }} />
            </div>

            {errorForm && (
              <div style={{ background: '#FFF1F0', color: '#A8071A', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, marginBottom: 12, lineHeight: 1.45 }}>
                {errorForm}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGuardar} disabled={saving || !form.destino.trim()}
                style={{ flex: 1, padding: 12, background: '#7B2FBE', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1, fontFamily: 'Inter, sans-serif' }}>
                {saving ? 'Guardando...' : modal.tipo === 'nuevo' ? '✓ Agregar viaje' : '✓ Guardar cambios'}
              </button>
              {modal.tipo === 'editar' && (
                confirmarBorrar ? (
                  <button onClick={handleEliminar} disabled={saving}
                    style={{ padding: '12px 14px', background: '#CF1322', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    ¿Borrar?
                  </button>
                ) : (
                  <button onClick={() => setConfirmarBorrar(true)} disabled={saving} title="Eliminar viaje"
                    style={{ padding: '12px 16px', background: '#FFF1F0', color: '#CF1322', border: '1px solid #FFCCC7', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    🗑️
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
