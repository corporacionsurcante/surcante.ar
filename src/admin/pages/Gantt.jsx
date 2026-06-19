import React, { useState, useEffect, useRef } from 'react';
import { suscribirUnidades, suscribirViajes, agregarViaje, actualizarViaje, eliminarViaje, inicializarUnidades } from '../../firebase/ganttServices';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_MES = [31,28,31,30,31,30,31,31,30,31,30,31];
const COLORES = ['#00BCD4','#FF9800','#E91E63','#4CAF50','#9C27B0','#F44336','#2196F3','#FF5722','#009688','#FFC107','#3F51B5','#8BC34A'];
const TIPO_COLOR = { 'MIX 60': '#4A0FA8', 'Comun 45': '#1565C0' };

function diasEnMes(mes, anio) {
  if (mes === 1) return (anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0)) ? 29 : 28;
  return DIAS_MES[mes];
}

function fechaToKey(fecha) { return fecha.replace(/-/g, ''); }
function keyToFecha(key) { return `${key.slice(0,4)}-${key.slice(4,6)}-${key.slice(6,8)}`; }
function addDays(fecha, n) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function daysBetween(desde, hasta) {
  return Math.round((new Date(hasta+'T12:00:00') - new Date(desde+'T12:00:00')) / 86400000);
}

export default function Gantt() {
  const anio = new Date().getFullYear();
  const [unidades, setUnidades] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [modal, setModal] = useState(null); // { tipo: 'nuevo'|'editar', unidadId, fecha, turno, viaje? }
  const [form, setForm] = useState({ destino: '', desde: '', turnoSalida: 'M', hasta: '', turnoRegreso: 'T', color: COLORES[0], notas: '' });
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const u1 = suscribirUnidades(data => { setUnidades(data); setLoading(false); });
    const u2 = suscribirViajes(anio, setViajes);
    return () => { u1(); u2(); };
  }, [anio]);

  // Mapa de celdas ocupadas: { `${unidadId}_${fecha}_${turno}` : viaje }
  const celdas = {};
  viajes.forEach(v => {
    let d = v.desde;
    let dia = 0;
    const maxDias = daysBetween(v.desde, v.hasta) + 1;
    while (dia < maxDias) {
      const turnoInicio = dia === 0 ? v.turnoSalida : 'M';
      const turnoFin = dia === maxDias - 1 ? v.turnoRegreso : 'T';
      if (turnoInicio === 'M') celdas[`${v.unidadId}_${d}_M`] = v;
      if (turnoFin === 'T' || turnoInicio === 'M') celdas[`${v.unidadId}_${d}_T`] = v;
      d = addDays(d, 1);
      dia++;
    }
  });

  function abrirNuevo(unidadId, fecha, turno) {
    const f = fecha;
    setForm({ destino: '', desde: f, turnoSalida: turno, hasta: f, turnoRegreso: 'T', color: COLORES[Math.floor(Math.random()*COLORES.length)], notas: '' });
    setModal({ tipo: 'nuevo', unidadId, fecha, turno });
  }

  function abrirEditar(viaje) {
    setForm({ destino: viaje.destino, desde: viaje.desde, turnoSalida: viaje.turnoSalida, hasta: viaje.hasta, turnoRegreso: viaje.turnoRegreso, color: viaje.color, notas: viaje.notas || '' });
    setModal({ tipo: 'editar', viaje });
  }

  async function handleGuardar() {
    if (!form.destino.trim() || !form.desde || !form.hasta) return;
    setSaving(true);
    try {
      if (modal.tipo === 'nuevo') {
        await agregarViaje(anio, { ...form, unidadId: modal.unidadId });
      } else {
        await actualizarViaje(anio, modal.viaje.id, form);
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setMesActual(m => Math.max(0, m-1))}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #EDE8F8', background: '#fff', cursor: 'pointer', fontSize: 16 }}>‹</button>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#0A0A0F', minWidth: 160, textAlign: 'center' }}>
            {MESES[mesActual]} {anio}
          </span>
          <button onClick={() => setMesActual(m => Math.min(11, m+1))}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #EDE8F8', background: '#fff', cursor: 'pointer', fontSize: 16 }}>›</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MESES.map((m, i) => (
            <button key={i} onClick={() => setMesActual(i)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                borderColor: mesActual === i ? '#7B2FBE' : '#EDE8F8',
                background: mesActual === i ? '#7B2FBE' : '#fff',
                color: mesActual === i ? '#fff' : '#4A4A6A',
                fontFamily: 'Inter, sans-serif',
              }}>{m.slice(0,3)}</button>
          ))}
        </div>
      </div>

      {/* Gantt table */}
      <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #EDE8F8', background: '#fff' }} ref={scrollRef}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 11 }}>
          <thead>
            <tr>
              {/* Cabecera unidad */}
              <th rowSpan={2} style={{ padding: '8px 12px', background: '#0A0A0F', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', minWidth: 140, position: 'sticky', left: 0, zIndex: 3, borderRight: '2px solid #7B2FBE' }}>
                Unidad
              </th>
              {/* Días */}
              {Array.from({ length: diasMes }, (_, i) => {
                const fecha = `${anio}-${String(mesActual+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                const dow = new Date(fecha+'T12:00:00').getDay();
                const esFinde = dow === 0 || dow === 6;
                return (
                  <th key={i} colSpan={2} style={{
                    padding: '4px 2px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                    background: esFinde ? '#1a1a2e' : '#0A0A0F',
                    color: esFinde ? '#C4B5F8' : '#9090B0',
                    borderRight: '1px solid #1E1E2E', minWidth: 32,
                  }}>
                    {i+1}
                  </th>
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
                    <th style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 600, background: esFinde ? '#141420' : '#141420', color: '#555', width: 16, borderRight: '1px solid #1E1E2E' }}>M</th>
                    <th style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 600, background: esFinde ? '#141420' : '#141420', color: '#555', width: 16, borderRight: '1px solid #2A2A3E' }}>T</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {unidades.map((u, uidx) => (
              <tr key={u.id} style={{ background: uidx % 2 === 0 ? '#fff' : '#FAF8FF' }}>
                {/* Info unidad */}
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
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{u.interno}</span>
                    <div>
                      <div style={{ color: '#0A0A0F', fontWeight: 700 }}>{u.patente}</div>
                      <div style={{ color: '#9090B0', fontSize: 10, fontWeight: 500 }}>{u.tipo}</div>
                    </div>
                  </div>
                </td>
                {/* Celdas días */}
                {Array.from({ length: diasMes }, (_, di) => {
                  const fecha = `${anio}-${String(mesActual+1).padStart(2,'0')}-${String(di+1).padStart(2,'0')}`;
                  return ['M','T'].map(turno => {
                    const key = `${u.id}_${fecha}_${turno}`;
                    const viaje = celdas[key];
                    return (
                      <td key={`${di}_${turno}`}
                        onClick={() => viaje ? abrirEditar(viaje) : abrirNuevo(u.id, fecha, turno)}
                        style={{
                          width: 16, height: 28, padding: 0, cursor: 'pointer',
                          background: viaje ? viaje.color : 'transparent',
                          borderRight: turno === 'T' ? '1px solid #F0EDF8' : '1px solid #F8F6FF',
                          borderBottom: '1px solid #F0EDF8',
                          position: 'relative',
                          transition: 'filter .1s',
                        }}
                        title={viaje ? `${viaje.destino} (${viaje.desde} ${viaje.turnoSalida} → ${viaje.hasta} ${viaje.turnoRegreso})` : `${fecha} ${turno}`}
                      >
                        {viaje && turno === 'M' && (
                          <span style={{
                            position: 'absolute', left: 1, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 8, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap',
                            overflow: 'hidden', maxWidth: 60, textShadow: '0 1px 2px rgba(0,0,0,.4)',
                            pointerEvents: 'none',
                          }}>
                            {viaje.destino}
                          </span>
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

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(TIPO_COLOR).map(([tipo, color]) => (
          <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4A4A6A', fontWeight: 500 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: 'inline-block' }} />
            {tipo}
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#9090B0', marginLeft: 'auto' }}>
          Click en celda vacía para asignar · Click en viaje para editar
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 20,
        }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0A0A0F' }}>
                {modal.tipo === 'nuevo' ? '+ Nuevo viaje' : '✏️ Editar viaje'}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9090B0' }}>✕</button>
            </div>

            {/* Destino */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Destino</label>
              <input value={form.destino} onChange={e => setForm(f => ({...f, destino: e.target.value}))}
                placeholder="ej: Mar del Plata"
                style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
            </div>

            {/* Desde / Turno salida */}
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

            {/* Hasta / Turno regreso */}
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

            {/* Color */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Color del viaje</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORES.map(c => (
                  <div key={c} onClick={() => setForm(f => ({...f, color: c}))}
                    style={{
                      width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid #0A0A0F' : '2px solid transparent',
                      transition: 'border .1s',
                    }} />
                ))}
              </div>
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Notas (opcional)</label>
              <input value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))}
                placeholder="ej: Contacto cliente, precio acordado..."
                style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGuardar} disabled={saving || !form.destino.trim()}
                style={{
                  flex: 1, padding: 12, background: '#7B2FBE', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1,
                  fontFamily: 'Inter, sans-serif',
                }}>
                {saving ? 'Guardando...' : modal.tipo === 'nuevo' ? '✓ Agregar viaje' : '✓ Guardar cambios'}
              </button>
              {modal.tipo === 'editar' && (
                <button onClick={handleEliminar} disabled={saving}
                  style={{
                    padding: '12px 16px', background: '#FFF1F0', color: '#CF1322',
                    border: '1px solid #FFCCC7', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>
                  🗑️
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
