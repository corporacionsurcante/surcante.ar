import React, { useEffect, useState } from 'react';
import { suscribirUnidades, agregarUnidad, actualizarUnidad, eliminarUnidad, inicializarUnidades } from '../../firebase/ganttServices';

const TIPOS = ['MIX 60', 'Comun 45', 'Minibus 24', 'Minibus 19'];

const FORM_VACIO = { interno: '', patente: '', tipo: 'MIX 60', butacas: 60, empresa: 'SURCANTE', venceTecnica: '', activa: true };

export default function Flota() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'nueva' | unidad
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => suscribirUnidades(
    data => { setUnidades(data); setLoading(false); },
    () => { setError('No se pudo leer la flota.'); setLoading(false); },
  ), []);

  async function handleInicializar() {
    setError('');
    try { await inicializarUnidades(); } catch (e) { console.error(e); setError('No se pudieron cargar las unidades.'); }
  }

  function abrirNueva() {
    setError('');
    setForm(FORM_VACIO);
    setConfirmEliminar(false);
    setModal('nueva');
  }

  function abrirEditar(u) {
    setError('');
    setForm({
      interno: u.interno || '',
      patente: u.patente || '',
      tipo: u.tipo || 'MIX 60',
      butacas: u.butacas || 60,
      empresa: u.empresa || 'SURCANTE',
      venceTecnica: u.venceTecnica || '',
      activa: u.activa !== false,
    });
    setConfirmEliminar(false);
    setModal(u);
  }

  async function handleGuardar() {
    if (!form.interno || !form.patente) return;
    const interno = parseInt(form.interno, 10);
    if (!Number.isFinite(interno)) { setError('El número de interno no es válido.'); return; }
    const repetido = unidades.find(u => Number(u.interno) === interno && (modal === 'nueva' || u.id !== modal.id));
    if (repetido) { setError(`Ya existe la unidad con interno ${interno}.`); return; }
    setSaving(true);
    setError('');
    try {
      const data = {
        ...form,
        patente: String(form.patente).trim().toUpperCase(),
        interno,
        butacas: parseInt(form.butacas, 10) || 0,
      };
      if (modal === 'nueva') {
        await agregarUnidad(data);
      } else {
        await actualizarUnidad(modal.id, data);
      }
      setModal(null);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar la unidad. Revisá la conexión.');
    }
    setSaving(false);
  }

  async function handleEliminar() {
    if (!modal?.id) return;
    setSaving(true);
    try {
      await eliminarUnidad(modal.id);
      setModal(null);
    } catch (e) {
      console.error(e);
      setError('No se pudo eliminar la unidad.');
    }
    setSaving(false);
  }

  const TIPO_COLOR = { 'MIX 60': '#8B5CF6', 'Comun 45': '#1565C0', 'Minibus 24': '#00796B', 'Minibus 19': '#558B2F' };

  if (loading) return <div className="admin-loading">Cargando flota...</div>;

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Flota ({unidades.length} unidades)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unidades.length === 0 && (
            <button className="section-action" style={{ background: 'rgba(240,238,255,0.55)' }} onClick={handleInicializar}>
              Cargar unidades Surcante
            </button>
          )}
          <button className="section-action" onClick={abrirNueva}>+ Nueva unidad</button>
        </div>
      </div>

      {error && modal === null && (
        <div style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>⛔ {error}</div>
      )}

      {unidades.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🚌</div>
          No hay unidades cargadas. Usá el botón "Cargar unidades Surcante" para importar las actuales.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Interno</th>
                <th>Patente</th>
                <th>Tipo</th>
                <th>Butacas</th>
                <th>Empresa</th>
                <th>Vence técnica</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {unidades.map(u => (
                <tr key={u.id}>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 800,
                      background: TIPO_COLOR[u.tipo] || '#8B5CF6', color: '#fff',
                    }}>{u.interno}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{u.patente}</td>
                  <td>{u.tipo}</td>
                  <td>{u.butacas}</td>
                  <td>
                    <span style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {u.empresa}
                    </span>
                  </td>
                  <td style={{ color: u.venceTecnica && new Date(u.venceTecnica) < new Date() ? '#EF4444' : 'rgba(240,238,255,0.55)' }}>
                    {u.venceTecnica || '—'}
                  </td>
                  <td>
                    <span style={{
                      background: u.activa !== false ? '#E6FBF5' : '#FFF1F0',
                      color: u.activa !== false ? '#2DD4BF' : '#EF4444',
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    }}>
                      {u.activa !== false ? '✅ Activa' : '❌ Inactiva'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => abrirEditar(u)}
                      style={{ background: '#F3EDFB', color: '#8B5CF6', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva / editar */}
      {modal !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 20,
        }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#0D0D1A', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#F0EEFF' }}>
                {modal === 'nueva' ? '+ Nueva unidad' : `✏️ Editar unidad ${form.interno}`}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'rgba(240,238,255,0.45)' }}>✕</button>
            </div>

            {[
              { label: 'Número de interno', field: 'interno', type: 'number', placeholder: 'ej: 201' },
              { label: 'Patente', field: 'patente', type: 'text', placeholder: 'ej: AH 704 NR' },
              { label: 'Empresa', field: 'empresa', type: 'text', placeholder: 'ej: SURCANTE' },
              { label: 'Butacas', field: 'butacas', type: 'number', placeholder: 'ej: 60' },
              { label: 'Vencimiento técnica', field: 'venceTecnica', type: 'date', placeholder: '' },
            ].map(({ label, field, type, placeholder }) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(240,238,255,0.45)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid rgba(139,92,246,0.20)', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#131324', color: '#F0EEFF' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(240,238,255,0.45)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Tipo de unidad</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                style={{ width: '100%', border: '1.5px solid rgba(139,92,246,0.20)', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#131324' }}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(240,238,255,0.45)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Estado</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ val: true, label: '✅ Activa' }, { val: false, label: '❌ Inactiva' }].map(opt => (
                  <div key={String(opt.val)} onClick={() => setForm(f => ({ ...f, activa: opt.val }))}
                    style={{
                      flex: 1, padding: '10px', textAlign: 'center', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${form.activa === opt.val ? '#8B5CF6' : 'rgba(139,92,246,0.20)'}`,
                      background: form.activa === opt.val ? 'rgba(139,92,246,0.15)' : 'transparent',
                      color: form.activa === opt.val ? '#8B5CF6' : 'rgba(240,238,255,0.55)',
                      fontWeight: 600, fontSize: 13,
                    }}>
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{error}</div>
            )}
            <button onClick={handleGuardar} disabled={saving || !form.interno || !form.patente}
              style={{
                width: '100%', padding: 13, background: '#8B5CF6', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1,
                fontFamily: 'Inter, sans-serif', marginBottom: 8,
              }}>
              {saving ? 'Guardando...' : modal === 'nueva' ? '✓ Agregar unidad' : '✓ Guardar cambios'}
            </button>

            {modal !== 'nueva' && (
              <>
                {!confirmEliminar ? (
                  <button onClick={() => setConfirmEliminar(true)}
                    style={{ width: '100%', padding: 11, background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    🗑️ Eliminar unidad
                  </button>
                ) : (
                  <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600, marginBottom: 10 }}>
                      ¿Confirmás que querés eliminar la unidad {form.interno}?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmEliminar(false)}
                        style={{ flex: 1, padding: 9, background: '#131324', border: '1px solid rgba(139,92,246,0.20)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                        Cancelar
                      </button>
                      <button onClick={handleEliminar} disabled={saving}
                        style={{ flex: 1, padding: 9, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>
                        Sí, eliminar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
