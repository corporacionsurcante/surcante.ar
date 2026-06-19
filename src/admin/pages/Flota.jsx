import React, { useEffect, useState } from 'react';
import { suscribirFlota, actualizarUnidad, inicializarFlota } from '../../firebase/services';

export default function Flota() {
  const [flota, setFlota] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState({});

  useEffect(() => {
    const unsub = suscribirFlota(data => { setFlota(data); setLoading(false); });
    return unsub;
  }, []);

  async function handleInit() {
    await inicializarFlota();
  }

  async function handleSave(u) {
    await actualizarUnidad(u.id, {
      usdKm: parseFloat(u.usdKm),
      disponibles: parseInt(u.disponibles),
      disponible: u.disponible,
    });
    setSaved(prev => ({ ...prev, [u.id]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [u.id]: false })), 2000);
  }

  function update(id, field, value) {
    setFlota(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
  }

  if (loading) return <div className="admin-loading">Cargando flota...</div>;

  if (flota.length === 0) return (
    <div className="admin-empty">
      <div className="admin-empty-icon">🚌</div>
      <div style={{ marginBottom: 16 }}>No hay unidades cargadas aún.</div>
      <button className="section-action" onClick={handleInit}>Inicializar flota por defecto</button>
    </div>
  );

  const iconos = { u1: '🚌', u2: '🚌', u3: '🚐' };

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Gestión de flota</div>
      </div>
      <div className="flota-grid">
        {flota.map(u => (
          <div key={u.id} className="flota-card">
            <div className="flota-card-header">
              <div className="flota-ico">{iconos[u.tipo] || '🚌'}</div>
              <div>
                <div className="flota-name">{u.nombre}</div>
                <div className="flota-detail">{u.butacas} butacas · {u.features}</div>
              </div>
            </div>

            <div className="flota-field">
              <label>Precio por km (USD)</label>
              <input type="number" step="0.1" min="0"
                value={u.usdKm}
                onChange={e => update(u.id, 'usdKm', e.target.value)}
              />
            </div>

            <div className="flota-field">
              <label>Unidades disponibles</label>
              <input type="number" min="0" max="20"
                value={u.disponibles}
                onChange={e => update(u.id, 'disponibles', e.target.value)}
              />
            </div>

            <div className="flota-toggle">
              <span className="flota-toggle-label">
                {u.disponible ? '✅ Activa para cotizar' : '❌ Fuera de servicio'}
              </span>
              <label className="toggle-switch">
                <input type="checkbox" checked={u.disponible}
                  onChange={e => update(u.id, 'disponible', e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <button
              className={`flota-save ${saved[u.id] ? 'saved' : ''}`}
              onClick={() => handleSave(u)}>
              {saved[u.id] ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
