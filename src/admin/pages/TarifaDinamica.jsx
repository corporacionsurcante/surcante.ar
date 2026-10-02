import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebase/config';
import { useTarifaDinamica } from '../../hooks/useTarifaDinamica';
import { hoyAR, ventanaTarifa, CONFIG_TARIFA_DEFAULT } from '../../utils/feriados';

const VIOLETA = '#7B2FBE';
const BORDE = '#EDE8F8';
const GRIS = '#9090B0';

function fechaCorta(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const campo = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${BORDE}`, borderRadius: 10,
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
};
const etiqueta = { fontSize: 12, fontWeight: 700, color: GRIS, marginBottom: 4, display: 'block' };

export default function TarifaDinamica() {
  const { config, calendario, findes, loading } = useTarifaDinamica();
  const [form, setForm] = useState(CONFIG_TARIFA_DEFAULT);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [actualizando, setActualizando] = useState(false);
  const [extra, setExtra] = useState({ desde: '', hasta: '', motivo: '' });

  useEffect(() => { setForm(config); }, [config]);

  function aviso(t) { setMsg(t); setTimeout(() => setMsg(''), 3500); }

  async function guardar(parche) {
    setGuardando(true);
    try {
      await setDoc(doc(db, 'config', 'tarifaDinamica'), { ...form, ...parche }, { merge: true });
      aviso('Guardado');
    } catch (e) {
      aviso('No se pudo guardar: ' + e.message);
    }
    setGuardando(false);
  }

  async function alternar() {
    const activa = !form.activa;
    setForm(f => ({ ...f, activa }));
    await guardar({ activa });
  }

  function alternarFinde(id) {
    const excluidos = form.excluidos.includes(id)
      ? form.excluidos.filter(x => x !== id)
      : [...form.excluidos, id];
    setForm(f => ({ ...f, excluidos }));
  }

  function agregarExtra() {
    if (!extra.desde) return;
    const hasta = extra.hasta && extra.hasta >= extra.desde ? extra.hasta : extra.desde;
    setForm(f => ({ ...f, fechasExtra: [...f.fechasExtra, { desde: extra.desde, hasta, motivo: extra.motivo.trim() }] }));
    setExtra({ desde: '', hasta: '', motivo: '' });
  }

  function quitarExtra(i) {
    setForm(f => ({ ...f, fechasExtra: f.fechasExtra.filter((_, k) => k !== i) }));
  }

  async function actualizarCalendario() {
    setActualizando(true);
    try {
      const token = await getAuth().currentUser.getIdToken();
      const resp = await fetch('/api/actualizar-feriados', { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || 'Error desconocido');
      aviso(data.guardado ? 'Calendario actualizado' : 'La fuente no devolvió datos nuevos; se conserva el calendario actual');
    } catch (e) {
      aviso('No se pudo actualizar: ' + e.message);
    }
    setActualizando(false);
  }

  if (loading) return <div className="admin-loading">Cargando tarifa dinámica...</div>;

  const hoy = hoyAR();
  const proximos = findes.filter(f => f.hasta >= hoy);
  const actualizado = calendario.actualizadoEn
    ? new Date(calendario.actualizadoEn).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
    : 'nunca (se usa el calendario de respaldo)';

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Tarifa dinámica · fines de semana largos</div>
      </div>

      {/* Botón principal */}
      <div style={{
        background: '#fff', border: `1.5px solid ${form.activa ? VIOLETA : BORDE}`, borderRadius: 14,
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: form.activa ? VIOLETA : '#1A1A2E' }}>
            {form.activa ? `Activa · tarifa ×${form.multiplicador}` : 'Desactivada · tarifa normal'}
          </div>
          <div style={{ fontSize: 13, color: GRIS, marginTop: 4, lineHeight: 1.5 }}>
            Cuando está activa, toda cotización cuyas fechas toquen un fin de semana largo se multiplica por {form.multiplicador}.
            El cliente ve el recargo detallado en la cotización.
          </div>
        </div>
        <button onClick={alternar} disabled={guardando}
          style={{
            width: 64, height: 34, borderRadius: 20, border: 'none', cursor: 'pointer',
            background: form.activa ? VIOLETA : '#D5D0E3', position: 'relative', transition: 'background .15s',
          }}
          aria-pressed={form.activa} aria-label="Activar tarifa dinámica">
          <span style={{
            position: 'absolute', top: 4, left: form.activa ? 34 : 4, width: 26, height: 26,
            borderRadius: '50%', background: '#fff', transition: 'left .15s',
          }} />
        </button>
      </div>

      {/* Parámetros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div>
          <label style={etiqueta}>Multiplicador</label>
          <input type="number" min="1" step="0.1" style={campo} value={form.multiplicador}
            onChange={e => setForm(f => ({ ...f, multiplicador: parseFloat(e.target.value) || 1 }))} />
        </div>
        <div>
          <label style={etiqueta}>Días antes del finde largo</label>
          <input type="number" min="0" max="7" style={campo} value={form.margenAntes}
            onChange={e => setForm(f => ({ ...f, margenAntes: parseInt(e.target.value, 10) || 0 }))} />
        </div>
        <div>
          <label style={etiqueta}>Días después del finde largo</label>
          <input type="number" min="0" max="7" style={campo} value={form.margenDespues}
            onChange={e => setForm(f => ({ ...f, margenDespues: parseInt(e.target.value, 10) || 0 }))} />
        </div>
      </div>

      {/* Próximos fines de semana largos */}
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Próximos fines de semana largos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {proximos.length === 0 && (
          <div style={{ fontSize: 13, color: GRIS }}>No hay fines de semana largos cargados hacia adelante.</div>
        )}
        {proximos.map(f => {
          const v = ventanaTarifa(f, form.margenAntes, form.margenDespues);
          const lleva = !form.excluidos.includes(f.id);
          return (
            <label key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer',
              background: '#fff', border: `1.5px solid ${lleva ? VIOLETA : BORDE}`, borderRadius: 12,
            }}>
              <input type="checkbox" checked={lleva} onChange={() => alternarFinde(f.id)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {fechaCorta(f.desde)} al {fechaCorta(f.hasta)} · {f.dias} días
                </div>
                <div style={{ fontSize: 12, color: GRIS }}>{f.nombre}</div>
                <div style={{ fontSize: 12, color: GRIS }}>
                  Recargo para viajes entre {fechaCorta(v.desde)} y {fechaCorta(v.hasta)}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Fechas extra */}
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Otras fechas de alta demanda</div>
      <div style={{ fontSize: 12, color: GRIS, marginBottom: 8 }}>
        Vacaciones de invierno, Semana Santa extendida, eventos puntuales, etc.
      </div>
      {form.fechasExtra.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', border: `1.5px solid ${BORDE}`, borderRadius: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{fechaCorta(e.desde)}{e.hasta !== e.desde ? ` al ${fechaCorta(e.hasta)}` : ''}</strong>
            {e.motivo ? ` · ${e.motivo}` : ''}
          </div>
          <button onClick={() => quitarExtra(i)} style={{ border: 'none', background: 'none', color: '#CF1322', fontWeight: 700, cursor: 'pointer' }}>Quitar</button>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 24 }}>
        <input type="date" style={campo} value={extra.desde} onChange={e => setExtra(x => ({ ...x, desde: e.target.value }))} />
        <input type="date" style={campo} value={extra.hasta} onChange={e => setExtra(x => ({ ...x, hasta: e.target.value }))} />
        <input type="text" placeholder="Motivo (opcional)" style={campo} value={extra.motivo} onChange={e => setExtra(x => ({ ...x, motivo: e.target.value }))} />
        <button onClick={agregarExtra} style={{ ...campo, background: '#F4F2FA', fontWeight: 700, cursor: 'pointer', color: VIOLETA }}>Agregar fecha</button>
      </div>

      <button onClick={() => guardar({})} disabled={guardando}
        style={{ width: '100%', padding: '13px 16px', background: VIOLETA, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 28 }}>
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Estado del calendario */}
      <div style={{ background: '#F9F8FD', border: `1.5px solid ${BORDE}`, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Calendario de feriados</div>
        <div style={{ fontSize: 12, color: GRIS, lineHeight: 1.6, marginBottom: 10 }}>
          Última actualización: {actualizado}.<br />
          Se actualiza solo el día 1 de cada mes. Fuente oficial de referencia:{' '}
          <a href="https://www.argentina.gob.ar/feriados" target="_blank" rel="noreferrer" style={{ color: VIOLETA }}>argentina.gob.ar/feriados</a>.
        </div>
        <button onClick={actualizarCalendario} disabled={actualizando}
          style={{ padding: '9px 14px', background: '#fff', border: `1.5px solid ${VIOLETA}`, color: VIOLETA, borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
          {actualizando ? 'Actualizando...' : 'Actualizar ahora'}
        </button>
      </div>

      {msg && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1A1A2E', color: '#fff', padding: '10px 18px', borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 50 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
