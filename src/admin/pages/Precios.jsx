import React, { useEffect, useState } from 'react';
import { suscribirPrecios, actualizarPrecios, inicializarPrecios } from '../../firebase/services';

const UNIDADES = [
  { id: 'u1', nombre: 'Omnibus Premium (60 but.)', ico: '🚌' },
  { id: 'u2', nombre: 'Omnibus Estándar (45 but.)', ico: '🚌' },
  { id: 'u3', nombre: 'Minibus Ejecutivo (24 but.)', ico: '🚐' },
];

export default function Precios() {
  const [precios, setPrecios] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = suscribirPrecios(data => { setPrecios(data); setLoading(false); });
    return unsub;
  }, []);

  async function handleInit() {
    await inicializarPrecios();
  }

  function updateUnidad(uid, field, value) {
    setPrecios(prev => ({
      ...prev,
      [uid]: { ...prev[uid], [field]: value }
    }));
  }

  function updateMov(uid, idx, value) {
    setPrecios(prev => {
      const movs = [...(prev[uid]?.movUSD || [110, 170, 250])];
      movs[idx] = parseFloat(value) || 0;
      return { ...prev, [uid]: { ...prev[uid], movUSD: movs } };
    });
  }

  async function handleSave() {
    await actualizarPrecios(precios);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="admin-loading">Cargando precios...</div>;

  if (!precios) return (
    <div className="admin-empty">
      <div className="admin-empty-icon">💰</div>
      <div style={{ marginBottom: 16 }}>No hay precios configurados.</div>
      <button className="section-action" onClick={handleInit}>Inicializar precios por defecto</button>
    </div>
  );

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Tarifas y precios</div>
      </div>

      {UNIDADES.map(u => (
        <div key={u.id} className="precios-card">
          <div className="precios-title">
            {u.ico} {u.nombre}
          </div>
          <div className="precios-grid">
            <div className="precio-field">
              <label>USD por km</label>
              <input type="number" step="0.1" min="0"
                value={precios[u.id]?.usdKm || ''}
                onChange={e => updateUnidad(u.id, 'usdKm', parseFloat(e.target.value))}
              />
            </div>
            <div className="precio-field">
              <label>Descuento movimientos (%)</label>
              <input type="number" step="1" min="0" max="100"
                value={((precios[u.id]?.movDesc || 0) * 100).toFixed(0)}
                onChange={e => updateUnidad(u.id, 'movDesc', parseFloat(e.target.value) / 100)}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Precio movimientos en destino (USD/día)
            </div>
            <div className="precios-grid">
              {[0, 1, 2].map(i => (
                <div key={i} className="precio-field">
                  <label>{i + 1} movimiento{i > 0 ? 's' : ''}/día</label>
                  <input type="number" step="1" min="0"
                    value={precios[u.id]?.movUSD?.[i] || ''}
                    onChange={e => updateMov(u.id, i, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="precios-card">
        <div className="precios-title">⚙️ Configuración general</div>
        <div className="precios-grid">
          <div className="precio-field">
            <label>Km incluidos por movimiento</label>
            <input type="number" min="0"
              value={precios.kmMovIncluidos || 50}
              onChange={e => setPrecios(prev => ({ ...prev, kmMovIncluidos: parseInt(e.target.value) }))}
            />
          </div>
          <div className="precio-field">
            <label>IVA (%)</label>
            <input type="number" step="1" min="0"
              value={((precios.iva || 0.21) * 100).toFixed(0)}
              onChange={e => setPrecios(prev => ({ ...prev, iva: parseFloat(e.target.value) / 100 }))}
            />
          </div>
          <div className="precio-field">
            <label>Seña (%)</label>
            <input type="number" step="1" min="0"
              value={((precios.senaPorc || 0.30) * 100).toFixed(0)}
              onChange={e => setPrecios(prev => ({ ...prev, senaPorc: parseFloat(e.target.value) / 100 }))}
            />
          </div>
        </div>
      </div>

      <button className={`precios-save ${saved ? 'saved' : ''}`} onClick={handleSave}>
        {saved ? '✓ Precios guardados' : 'Guardar todos los precios'}
      </button>
    </div>
  );
}
