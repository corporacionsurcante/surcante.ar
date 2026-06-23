import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { suscribirUnidades, suscribirViajes, agregarViaje, actualizarViaje, eliminarViaje, inicializarUnidades } from '../../firebase/ganttServices';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_MES = [31,28,31,30,31,30,31,31,30,31,30,31];
const COLORES = ['#00BCD4','#FF9800','#E91E63','#4CAF50','#9C27B0','#F44336','#2196F3','#FF5722','#009688','#FFC107','#3F51B5','#8BC34A'];
const TIPO_COLOR = { 'MIX 60': '#4A0FA8', 'Comun 45': '#1565C0', 'Minibus 24': '#00796B', 'Minibus 19': '#558B2F' };

function diasEnMes(mes, anio) {
  if (mes === 1) return (anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0)) ? 29 : 28;
  return DIAS_MES[mes];
}

function addDays(fecha, n) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(desde, hasta) {
  return Math.round((new Date(hasta+'T12:00:00') - new Date(desde+'T12:00:00')) / 86400000);
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

export default function Gantt() {
  const anio = new Date().getFullYear();
  const [unidades, setUnidades] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ destino: '', desde: '', turnoSalida: 'M', hasta: '', turnoRegreso: 'T', color: COLORES[0], notas: '' });
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    const u1 = suscribirUnidades(data => { setUnidades(data); setLoading(false); });
    const u2 = suscribirViajes(anio, setViajes);
    return () => { u1(); u2(); };
  }, [anio]);

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

  // Mapa de celdas ocupadas
  const celdas = {};
  viajes.forEach(v => {
    const maxDias = daysBetween(v.desde, v.hasta) + 1;
    for (let dia = 0; dia < maxDias; dia++) {
      const fecha = addDays(v.desde, dia);
      const turnoInicio = dia === 0 ? v.turnoSalida : 'M';
      const turnoFin = dia === maxDias - 1 ? v.turnoRegreso : 'T';
      if (turnoInicio === 'M') celdas[`${v.unidadId}_${fecha}_M`] = v;
      if (turnoFin === 'T' || turnoInicio === 'M') celdas[`${v.unidadId}_${fecha}_T`] = v;
    }
  });

  function abrirNuevo(unidadId, fecha, turno) {
    setForm({ destino: '', desde: fecha, turnoSalida: turno, hasta: fecha, turnoRegreso: 'T', color: COLORES[Math.floor(Math.random()*COLORES.length)], notas: '' });
    setModal({ tipo: 'nuevo', unidadId });
  }

  function abrirEditar(viaje) {
    setForm({ destino: viaje.destino, desde: viaje.desde, turnoSalida: viaje.turnoSalida, hasta: viaje.hasta, turnoRegreso: viaje.turnoRegreso, color: viaje.color, notas: viaje.notas || '' });
    setModal({ tipo: 'editar', viaje });
  }

  async function handleGuardar() {
    if (!form.destino.trim() || !form.desde || !form.hasta) return;
    setSaving(true);
    try {
      const datos = { ...form, cargadoPor: currentUser?.email || 'desconocido' };
      if (modal.tipo === 'nuevo') {
        await agregarViaje(anio, { ...datos, unidadId: modal.unidadId });
      } else {
        await actualizarViaje(anio, modal.viaje.id, datos);
      }
      setModal(null);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function handleEliminar() {
    if (!modal?.viaje?.id) return;
    setSaving(true);
    await eliminarViaje(anio, modal.viaje.id);
    setModal(null);
    setSaving(false);
  }

  const diasMes = diasEnMes(mesActual, anio);

  if (loading) return <div className="admin-loading">Cargando Gantt...</div>;

  if (unidades.length === 0) return (
    <div className="admin-empty">
      <div className="admin-empty-icon">🚌</div>
      <div style={{ marginBottom: 16 }}>No hay unidades cargadas.</div>
      <button className="section-action" onClick={inicializarUnidades}>Inicializar unidades Surcante</button>
    </div>
  );

  const ganttContent = (
    <div ref={containerRef} style={{
      background: fullscreen ? '#0A0A0F' : 'transparent',
      padding: fullscreen ? 16 : 0,
      height: fullscreen ? '100vh' : 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setMesActual(m => Math.max(0, m-1))}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', background: fullscreen ? 'rgba(255,255,255,.08)' : '#fff', cursor: 'pointer', fontSize: 18, color: fullscreen ? '#fff' : '#333' }}>‹</button>
          <span style={{ fontSize: 18, fontWeight: 800, color: fullscreen ? '#fff' : '#0A0A0F', minWidth: 200, textAlign: 'center' }}>
            {MESES[mesActual]} {anio}
          </span>
          <button onClick={() => setMesActual(m => Math.min(11, m+1))}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', background: fullscreen ? 'rgba(255,255,255,.08)' : '#fff', cursor: 'pointer', fontSize: 18, color: fullscreen ? '#fff' : '#333' }}>›</button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MESES.map((m, i) => (
            <button key={i} onClick={() => setMesActual(i)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                borderColor: mesActual === i ? '#7B2FBE' : (fullscreen ? 'rgba(255,255,255,.15)' : '#EDE8F8'),
                background: mesActual === i ? '#7B2FBE' : 'transparent',
                color: mesActual === i ? '#fff' : (fullscreen ? 'rgba(255,255,255,.5)' : '#4A4A6A'),
                fontFamily: 'Inter, sans-serif',
              }}>{m.slice(0,3)}</button>
          ))}
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
          <div key={email} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: fullscreen ? 'rgba(255,255,255,.6)' : '#555' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: getUserColor(email), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
              {getUserLabel(email)}
            </span>
            {email}
          </div>
        ))}
      </div>

      {/* Tabla Gantt */}
      <div style={{ overflowX: 'auto', flex: 1, borderRadius: 10, border: `1px solid ${fullscreen ? 'rgba(255,255,255,.1)' : '#EDE8F8'}` }}>
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
                const fecha = `${anio}-${String(mesActual+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                const dow = new Date(fecha+'T12:00:00').getDay();
                const esFinde = dow === 0 || dow === 6;
                return (
                  <th key={i} colSpan={2} style={{
                    padding: '4px 2px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                    background: esFinde ? '#1a1a2e' : '#0A0A0F',
                    color: esFinde ? '#C4B5F8' : '#9090B0',
                    borderRight: '1px solid #1E1E2E', minWidth: 28,
                  }}>{i+1}</th>
                );
              })}
            </tr>
            <tr>
              {Array.from({ length: diasMes }, (_, i) => {
                const fecha = `${anio}-${String(mesActual+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                const dow = new Date(fecha+'T12:00:00').getDay();
                const esFinde = dow === 0 || dow === 6;
                return (
                  <React.Fragment key={i}>
                    <th style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 600, background: esFinde ? '#141420' : '#141420', color: '#555', width: 14, borderRight: '1px solid #1E1E2E' }}>M</th>
                    <th style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 600, background: '#141420', color: '#555', width: 14, borderRight: '1px solid #2A2A3E' }}>T</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {unidades.map((u, uidx) => (
              <tr key={u.id} style={{ background: uidx % 2 === 0 ? (fullscreen ? '#111118' : '#fff') : (fullscreen ? '#0D0D14' : '#FAF8FF') }}>
                <td style={{
                  padding: '6px 12px', fontWeight: 600, fontSize: 11,
                  background: uidx % 2 === 0 ? (fullscreen ? '#111118' : '#fff') : (fullscreen ? '#0D0D14' : '#FAF8FF'),
                  position: 'sticky', left: 0, zIndex: 2,
                  borderRight: '2px solid #7B2FBE', borderBottom: `1px solid ${fullscreen ? 'rgba(255,255,255,.06)' : '#F0EDF8'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 800,
                      background: TIPO_COLOR[u.tipo] || '#4A0FA8', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{u.interno}</span>
                    <div>
                      <div style={{ color: fullscreen ? '#fff' : '#0A0A0F', fontWeight: 700 }}>{u.patente}</div>
                      <div style={{ color: fullscreen ? 'rgba(255,255,255,.4)' : '#9090B0', fontSize: 10 }}>{u.tipo}</div>
                    </div>
                  </div>
                </td>
                {Array.from({ length: diasMes }, (_, di) => {
                  const fecha = `${anio}-${String(mesActual+1).padStart(2,'0')}-${String(di+1).padStart(2,'0')}`;
                  return ['M','T'].map(turno => {
                    const key = `${u.id}_${fecha}_${turno}`;
                    const viaje = celdas[key];
                    const userLabel = viaje?.cargadoPor ? getUserLabel(viaje.cargadoPor) : null;
                    return (
                      <td key={`${di}_${turno}`}
                        onClick={() => viaje ? abrirEditar(viaje) : abrirNuevo(u.id, fecha, turno)}
                        style={{
                          width: 14, height: 32, padding: 0, cursor: 'pointer',
                          background: viaje ? viaje.color : 'transparent',
                          borderRight: turno === 'T' ? `1px solid ${fullscreen ? 'rgba(255,255,255,.06)' : '#F0EDF8'}` : `1px solid ${fullscreen ? 'rgba(255,255,255,.03)' : '#F8F6FF'}`,
                          borderBottom: `1px solid ${fullscreen ? 'rgba(255,255,255,.06)' : '#F0EDF8'}`,
                          position: 'relative',
                        }}
                        title={viaje ? `${viaje.destino} · ${viaje.desde} → ${viaje.hasta} · Cargado por: ${viaje.cargadoPor || 'desconocido'}` : `${fecha} ${turno}`}>
                        {viaje && turno === 'M' && (
                          <div style={{ position: 'absolute', left: 1, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', pointerEvents: 'none' }}>
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
          <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: fullscreen ? 'rgba(255,255,255,.5)' : '#4A4A6A', fontWeight: 500 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: 'inline-block' }} />
            {tipo}
          </div>
        ))}
        <div style={{ fontSize: 11, color: fullscreen ? 'rgba(255,255,255,.3)' : '#9090B0', marginLeft: 'auto' }}>
          Click en celda vacía para asignar · Click en viaje para editar
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

            {modal.tipo === 'editar' && modal.viaje.cargadoPor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '6px 10px', background: '#F4F2FA', borderRadius: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: getUserColor(modal.viaje.cargadoPor), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                  {getUserLabel(modal.viaje.cargadoPor)}
                </span>
                <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Cargado por {modal.viaje.cargadoPor}</span>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Destino</label>
              <input value={form.destino} onChange={e => setForm(f => ({...f, destino: e.target.value}))}
                placeholder="ej: Mar del Plata"
                style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Salida</label>
                <input type="date" value={form.desde} onChange={e => setForm(f => ({...f, desde: e.target.value}))}
                  style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Turno salida</label>
                <select value={form.turnoSalida} onChange={e => setForm(f => ({...f, turnoSalida: e.target.value}))}
                  style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 10px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff' }}>
                  <option value="M">🌅 Mañana</option>
                  <option value="T">🌆 Tarde</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Regreso</label>
                <input type="date" value={form.hasta} onChange={e => setForm(f => ({...f, hasta: e.target.value}))}
                  style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Turno regreso</label>
                <select value={form.turnoRegreso} onChange={e => setForm(f => ({...f, turnoRegreso: e.target.value}))}
                  style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 10px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff' }}>
                  <option value="M">🌅 Mañana</option>
                  <option value="T">🌆 Tarde</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Color del viaje</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORES.map(col => (
                  <div key={col} onClick={() => setForm(f => ({...f, color: col}))}
                    style={{ width: 28, height: 28, borderRadius: 6, background: col, cursor: 'pointer', border: form.color === col ? '3px solid #0A0A0F' : '2px solid transparent', transition: 'border .1s' }} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Notas</label>
              <input value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))}
                placeholder="ej: Contacto, precio acordado..."
                style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGuardar} disabled={saving || !form.destino.trim()}
                style={{ flex: 1, padding: 12, background: '#7B2FBE', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1, fontFamily: 'Inter, sans-serif' }}>
                {saving ? 'Guardando...' : modal.tipo === 'nuevo' ? '✓ Agregar viaje' : '✓ Guardar cambios'}
              </button>
              {modal.tipo === 'editar' && (
                <button onClick={handleEliminar} disabled={saving}
                  style={{ padding: '12px 16px', background: '#FFF1F0', color: '#CF1322', border: '1px solid #FFCCC7', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  🗑️
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return ganttContent;
}
