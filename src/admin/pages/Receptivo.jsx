import React, { useState, useEffect } from 'react';
import {
  suscribirPreciosCityTour, actualizarPreciosCityTour, inicializarPreciosCityTour,
  suscribirCircuitos, agregarCircuito, actualizarCircuito, eliminarCircuito, inicializarCircuitos,
  suscribirTransfers, actualizarTransfer, inicializarTransfers,
} from '../../firebase/receptivoServices';

const TIPOS_UNIDAD = ['MIX 60', 'Comun 45', 'Minibus 24', 'Minibus 19'];
const TIPO_LABELS = { 'MIX 60': 'Omnibus 60 / Doble piso', 'Comun 45': 'Omnibus 45 butacas', 'Minibus 24': 'Minibus 24 butacas', 'Minibus 19': 'Minibus 19 butacas' };
const EMOJIS = ['🏛️','🦁','🎢','🚤','⛪','🎭','🌳','🏖️','⛵','🎪','🏔️','🌆','🎨','🍷','⚽'];

const FORM_CIRCUITO_VACIO = { nombre: '', emoji: '🏛️', descripcion: '', precioUSD: { 'MIX 60': '', 'Comun 45': '', 'Minibus 24': '', 'Minibus 19': '' }, activo: true };

export default function Receptivo() {
  const [tab, setTab] = useState('citytour');
  const [cityTour, setCityTour] = useState(null);
  const [circuitos, setCircuitos] = useState(null);
  const [transfers, setTransfers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(FORM_CIRCUITO_VACIO);
  const [saving, setSaving] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  useEffect(() => {
    const u1 = suscribirPreciosCityTour(d => { setCityTour(d); setLoading(false); });
    const u2 = suscribirCircuitos(setCircuitos);
    const u3 = suscribirTransfers(setTransfers);
    return () => { u1(); u2(); u3(); };
  }, []);

  async function handleInicializar() {
    setSaving(true);
    await inicializarPreciosCityTour();
    await inicializarCircuitos();
    await inicializarTransfers();
    setSaving(false);
  }

  // ---- CITY TOUR ----
  async function saveCityTour() {
    setSaving(true);
    await actualizarPreciosCityTour(cityTour);
    setSaved('citytour');
    setTimeout(() => setSaved(''), 2000);
    setSaving(false);
  }

  // ---- CIRCUITOS ----
  function abrirNuevoCircuito() {
    setForm(FORM_CIRCUITO_VACIO);
    setConfirmEliminar(false);
    setModal('nuevo');
  }

  function abrirEditarCircuito(c) {
    setForm({ nombre: c.nombre, emoji: c.emoji, descripcion: c.descripcion, precioUSD: { ...c.precioUSD }, activo: c.activo !== false });
    setConfirmEliminar(false);
    setModal(c);
  }

  async function handleGuardarCircuito() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const data = { ...form, precioUSD: Object.fromEntries(TIPOS_UNIDAD.map(t => [t, parseFloat(form.precioUSD[t]) || 0])) };
    if (modal === 'nuevo') await agregarCircuito(data);
    else await actualizarCircuito(modal.id, data);
    setModal(null);
    setSaving(false);
  }

  async function handleEliminarCircuito() {
    if (!modal?.id) return;
    setSaving(true);
    await eliminarCircuito(modal.id);
    setModal(null);
    setSaving(false);
  }

  // ---- TRANSFERS ----
  async function saveTransfer(id, data) {
    setSaving(true);
    await actualizarTransfer(id, data);
    setSaved('transfer_' + id);
    setTimeout(() => setSaved(''), 2000);
    setSaving(false);
  }

  if (loading) return <div className="admin-loading">Cargando receptivo...</div>;

  if (!cityTour && !circuitos && !transfers) return (
    <div className="admin-empty">
      <div className="admin-empty-icon">🏛️</div>
      <div style={{ marginBottom: 16 }}>No hay configuración de receptivo todavía.</div>
      <button className="section-action" onClick={handleInicializar} disabled={saving}>
        {saving ? 'Inicializando...' : 'Inicializar con valores por defecto'}
      </button>
    </div>
  );

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #EDE8F8', paddingBottom: 0 }}>
        {[
          { id: 'citytour', label: '🏛️ City Tour CABA' },
          { id: 'circuitos', label: '🎡 Circuitos' },
          { id: 'transfers', label: '✈️ Transfers' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#7B2FBE' : 'transparent'}`,
              background: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: 13, fontWeight: 600, color: tab === t.id ? '#7B2FBE' : '#9090B0',
              transition: 'all .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CITY TOUR */}
      {tab === 'citytour' && cityTour && (
        <div>
          <div className="section-header">
            <div className="section-title">Precios City Tour CABA (USD/día)</div>
          </div>
          <div className="precios-card">
            <div style={{ fontSize: 12, color: '#9090B0', marginBottom: 16, fontWeight: 500 }}>
              Se convierten automáticamente a pesos usando el dólar BNA al momento de cotizar.
            </div>
            <div className="precios-grid">
              {TIPOS_UNIDAD.map(tipo => (
                <div key={tipo} className="precio-field">
                  <label>{TIPO_LABELS[tipo]}</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9090B0', fontWeight: 600 }}>USD</span>
                    <input type="number" step="0.01" min="0"
                      value={cityTour[tipo] || ''}
                      onChange={e => setCityTour(prev => ({ ...prev, [tipo]: parseFloat(e.target.value) || 0 }))}
                      style={{ paddingLeft: 42 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button className={`precios-save ${saved === 'citytour' ? 'saved' : ''}`} onClick={saveCityTour} disabled={saving}>
              {saved === 'citytour' ? '✓ Guardado' : 'Guardar precios City Tour'}
            </button>
          </div>
        </div>
      )}

      {/* CIRCUITOS */}
      {tab === 'circuitos' && (
        <div>
          <div className="section-header">
            <div className="section-title">Circuitos especiales ({circuitos?.length || 0})</div>
            <button className="section-action" onClick={abrirNuevoCircuito}>+ Nuevo circuito</button>
          </div>

          {!circuitos || circuitos.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🎡</div>
              <div style={{ marginBottom: 12 }}>No hay circuitos. Inicializá los valores por defecto o agregá uno nuevo.</div>
              <button className="section-action" onClick={inicializarCircuitos}>Cargar circuitos por defecto</button>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Circuito</th>
                    <th>Descripción</th>
                    <th>Omni 60</th>
                    <th>Omni 45</th>
                    <th>Minibus</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {circuitos.map(c => (
                    <tr key={c.id}>
                      <td><span style={{ fontSize: 16 }}>{c.emoji}</span> <strong>{c.nombre}</strong></td>
                      <td style={{ color: '#9090B0', fontSize: 12 }}>{c.descripcion}</td>
                      <td>USD {c.precioUSD?.['MIX 60']?.toFixed(2)}</td>
                      <td>USD {c.precioUSD?.['Comun 45']?.toFixed(2)}</td>
                      <td>USD {c.precioUSD?.['Minibus 24']?.toFixed(2)}</td>
                      <td>
                        <span style={{ background: c.activo !== false ? '#E6FBF5' : '#FFF1F0', color: c.activo !== false ? '#007A5A' : '#CF1322', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          {c.activo !== false ? '✅ Activo' : '❌ Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => abrirEditarCircuito(c)}
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
        </div>
      )}

      {/* TRANSFERS */}
      {tab === 'transfers' && (
        <div>
          <div className="section-header">
            <div className="section-title">Precios transfers aeropuerto (USD)</div>
          </div>
          {!transfers || transfers.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">✈️</div>
              <div style={{ marginBottom: 12 }}>No hay transfers configurados.</div>
              <button className="section-action" onClick={inicializarTransfers}>Cargar transfers por defecto</button>
            </div>
          ) : (
            <div className="flota-grid">
              {transfers.map(t => (
                <TransferCard key={t.id} transfer={t} onSave={saveTransfer} savedId={saved} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal circuito */}
      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0A0A0F' }}>
                {modal === 'nuevo' ? '+ Nuevo circuito' : `✏️ Editar: ${form.nombre}`}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9090B0' }}>✕</button>
            </div>

            {/* Emoji selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Emoji</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOJIS.map(e => (
                  <div key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${form.emoji === e ? '#7B2FBE' : '#EDE8F8'}`, background: form.emoji === e ? '#EDE9FB' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer' }}>
                    {e}
                  </div>
                ))}
              </div>
            </div>

            {[
              { label: 'Nombre del circuito', field: 'nombre', placeholder: 'ej: Luján' },
              { label: 'Descripción', field: 'descripcion', placeholder: 'ej: Basílica de Luján' },
            ].map(({ label, field, placeholder }) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{label}</label>
                <input placeholder={placeholder} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Precios por tipo de unidad (USD/día)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {TIPOS_UNIDAD.map(tipo => (
                  <div key={tipo}>
                    <label style={{ fontSize: 10, color: '#9090B0', fontWeight: 600, display: 'block', marginBottom: 4 }}>{TIPO_LABELS[tipo]}</label>
                    <input type="number" step="0.01" min="0" placeholder="USD"
                      value={form.precioUSD[tipo] || ''}
                      onChange={e => setForm(f => ({ ...f, precioUSD: { ...f.precioUSD, [tipo]: e.target.value } }))}
                      style={{ width: '100%', border: '1.5px solid #EDE8F8', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Estado</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ val: true, label: '✅ Activo' }, { val: false, label: '❌ Inactivo' }].map(opt => (
                  <div key={String(opt.val)} onClick={() => setForm(f => ({ ...f, activo: opt.val }))}
                    style={{ flex: 1, padding: 10, textAlign: 'center', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${form.activo === opt.val ? '#7B2FBE' : '#EDE8F8'}`, background: form.activo === opt.val ? '#EDE9FB' : '#fff', color: form.activo === opt.val ? '#4A0FA8' : '#4A4A6A', fontWeight: 600, fontSize: 13 }}>
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleGuardarCircuito} disabled={saving || !form.nombre.trim()}
              style={{ width: '100%', padding: 13, background: '#7B2FBE', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1, fontFamily: 'Inter, sans-serif', marginBottom: 8 }}>
              {saving ? 'Guardando...' : modal === 'nuevo' ? '✓ Agregar circuito' : '✓ Guardar cambios'}
            </button>

            {modal !== 'nuevo' && (
              !confirmEliminar ? (
                <button onClick={() => setConfirmEliminar(true)}
                  style={{ width: '100%', padding: 11, background: '#FFF1F0', color: '#CF1322', border: '1px solid #FFCCC7', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  🗑️ Eliminar circuito
                </button>
              ) : (
                <div style={{ background: '#FFF1F0', border: '1px solid #FFCCC7', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#CF1322', fontWeight: 600, marginBottom: 10 }}>¿Confirmás eliminar {form.nombre}?</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmEliminar(false)} style={{ flex: 1, padding: 9, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Cancelar</button>
                    <button onClick={handleEliminarCircuito} disabled={saving} style={{ flex: 1, padding: 9, background: '#CF1322', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>Sí, eliminar</button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TransferCard({ transfer, onSave, savedId }) {
  const [precio, setPrecio] = useState(transfer.precioUSD);
  const [activo, setActivo] = useState(transfer.activo !== false);
  const isSaved = savedId === 'transfer_' + transfer.id;

  return (
    <div className="flota-card">
      <div className="flota-card-header">
        <div className="flota-ico" style={{ fontSize: 22 }}>{transfer.emoji}</div>
        <div>
          <div className="flota-name">{transfer.nombre}</div>
          <div className="flota-detail">{transfer.descripcion}</div>
        </div>
      </div>
      <div className="flota-field">
        <label>Precio (USD)</label>
        <input type="number" step="1" min="0" value={precio}
          onChange={e => setPrecio(parseFloat(e.target.value) || 0)}
          style={{ paddingLeft: 12 }} />
      </div>
      <div className="flota-toggle">
        <span className="flota-toggle-label">{activo ? '✅ Activo' : '❌ Inactivo'}</span>
        <label className="toggle-switch">
          <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
          <span className="toggle-slider"></span>
        </label>
      </div>
      <button className={`flota-save ${isSaved ? 'saved' : ''}`}
        onClick={() => onSave(transfer.id, { precioUSD: precio, activo })}>
        {isSaved ? '✓ Guardado' : 'Guardar'}
      </button>
    </div>
  );
}
