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

  useEffect(() => {
    const unsub = suscribirUnidades(data => { setUnidades(data); setLoading(false); });
    return unsub;
  }, []);

  function abrirNueva() {
    setForm(FORM_VACIO);
    setConfirmEliminar(false);
    setModal('nueva');
  }

  function abrirEditar(u) {
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
    setSaving(true);
    try {
      const data = {
        ...form,
        interno: parseInt(form.interno),
        butacas: parseInt(form.butacas),
      };
      if (modal === 'nueva') {
        await agregarUnidad(data);
      } else {
        await actualizarUnidad(modal.id, data);
      }
      setModal(null);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function handleEliminar() {
    if (!modal?.id) return;
    setSaving(true);
    await eliminarUnidad(modal.id);
    setModal(null);
    setSaving(false);
  }

  const TIPO_COLOR = { 'MIX 60': '#4A0FA8', 'Comun 45': '#1565C0', 'Minibus 24': '#00796B', 'Minibus 19': '#558B2F' };

  if (loading) return <div className="admin-loading">Cargando flota...</div>;

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Flota ({unidades.length} unidades)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unidades.length === 0 && (
            <button className="section-action" style={{ background: '#555' }} onClick={inicializarUnidades}>
              Cargar unidades Surcante
            </button>
          )}
          <button className="section-action" onClick={abrirNueva}>+ Nueva unidad</button>
        </div>
      </div>

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
                      background: TIPO_COLOR[u.tipo] || '#4A0FA8', color: '#fff',
                    }}>{u.interno}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{u.patente}</td>
                  <td>{u.tipo}</td>
                  <td>{u.butacas}</td>
                  <td>
                    <span style={{ background: '#EDE9FB', color: '#4A0FA8', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {u.empresa}
                    </span>
                  </td>
                  <td style={{ color: u.venceTecnica && new Date(u.venceTecnica) < new Date() ? '#CF1322' : '#555' }}>
                    {u.venceTecnica || '—'}
                  </td>
                  <td>
                    <span style={{
                      background: u.activa !== false ? '#E6FBF5' : '#FFF1F0',
                      color: u.activa !== false ? '#007A5A' : '#CF1322',
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    }}>
                      {u.activa !== false ? '✅ Activa' : '❌ Inactiva'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => abrirEditar(u)}
                      style={{ background: '#F3EDFB', color: '#7B2FBE', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
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
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0A0A0F' }}>
                {modal === 'nueva' ? '+ Nueva unidad' : `✏️ Editar unidad ${form.interno}`}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9090B0' }}>✕</button>
            </div>

            {[
              { label: 'Número de interno', field: 'interno', type: 'number', placeholder: 'ej: 201' },
              { label: 'Patente', field: 'patente', type: 'text', placeholder: 'ej: AH 704 NR' },
              { label: 'Empresa', field: 'empresa', type: 'text', placeholder: 'ej: SURCANTE' },
              { label: 'Butacas', field: 'butacas', type: 'number', placeholder: 'ej: 60' },
              { label: 'Vencimiento técnica', field: 'venceTecnica', type: 'date', placeholder: '' },
            ].map(({ label, field, type, placeholder }) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Tipo de unidad</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff' }}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Estado</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ val: true, label: '✅ Activa' }, { val: false, label: '❌ Inactiva' }].map(opt => (
                  <div key={String(opt.val)} onClick={() => setForm(f => ({ ...f, activa: opt.val }))}
                    style={{
                      flex: 1, padding: '10px', textAlign: 'center', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${form.activa === opt.val ? '#7B2FBE' : '#EDE8F8'}`,
                      background: form.activa === opt.val ? '#EDE9FB' : '#fff',
                      color: form.activa === opt.val ? '#4A0FA8' : '#4A4A6A',
                      fontWeight: 600, fontSize: 13,
                    }}>
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleGuardar} disabled={saving || !form.interno || !form.patente}
              style={{
                width: '100%', padding: 13, background: '#7B2FBE', color: '#fff',
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
                    style={{ width: '100%', padding: 11, background: '#FFF1F0', color: '#CF1322', border: '1px solid #FFCCC7', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    🗑️ Eliminar unidad
                  </button>
                ) : (
                  <div style={{ background: '#FFF1F0', border: '1px solid #FFCCC7', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#CF1322', fontWeight: 600, marginBottom: 10 }}>
                      ¿Confirmás que querés eliminar la unidad {form.interno}?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmEliminar(false)}
                        style={{ flex: 1, padding: 9, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                        Cancelar
                      </button>
                      <button onClick={handleEliminar} disabled={saving}
                        style={{ flex: 1, padding: 9, background: '#CF1322', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>
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
