import React, { useEffect, useState } from 'react';
import { suscribirPrecios, actualizarPrecios, inicializarPrecios } from '../../firebase/services';
import { useDolar } from '../../hooks/useDolar';
import ConversorUSD from '../components/ConversorUSD';
import { precioMovimientosDiaUSD } from '../../utils/calculos';
import { PARAMETROS_DEFAULT } from '../../utils/parametros';

const UNIDADES = [
  { id: 'u1', nombre: 'Omnibus Mix 60', ico: '🚌' },
  { id: 'u2', nombre: 'Omnibus Común 45', ico: '🚌' },
  { id: 'u3', nombre: 'Minibus 19/24', ico: '🚐' },
];

export default function Precios() {
  const [precios, setPrecios] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const { dolar } = useDolar();

  useEffect(() => suscribirPrecios(
    data => { setPrecios(data); setLoading(false); },
    () => { setError('No se pudieron leer los precios.'); setLoading(false); },
  ), []);

  async function handleInit() {
    try { await inicializarPrecios(); } catch (e) { console.error(e); setError('No se pudieron inicializar los precios.'); }
  }

  const num = (v, def = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def; };
  const porc = (v, def) => { const n = Number(v); return v === undefined || v === null || v === '' || !Number.isFinite(n) ? def : n; };
  const verPorc = (v, def) => Math.round(porc(v, def) * 1000) / 10;
  const D = PARAMETROS_DEFAULT;

  function updateUnidad(uid, field, value) {
    setPrecios(prev => ({
      ...prev,
      [uid]: { ...prev[uid], [field]: value }
    }));
  }

  function updateMov(uid, idx, value) {
    setPrecios(prev => {
      const movs = [...(prev[uid]?.movUSD || [0, 0, 0])];
      movs[idx] = parseFloat(value) || 0;
      return { ...prev, [uid]: { ...prev[uid], movUSD: movs } };
    });
  }

  async function handleSave() {
    setGuardando(true);
    setError('');
    try {
      await actualizarPrecios(precios);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setError('No se pudieron guardar los precios. Revisá la conexión.');
    }
    setGuardando(false);
  }

  if (loading) return <div className="admin-loading">Cargando precios...</div>;

  if (!precios && error) return <div className="admin-empty"><div className="admin-empty-icon">⚠️</div>{error}</div>;

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
                onChange={e => updateUnidad(u.id, 'usdKm', num(e.target.value))}
              />
              <ConversorUSD usdValue={precios[u.id]?.usdKm} dolar={dolar} onChangeUSD={v => updateUnidad(u.id, 'usdKm', v)} />
            </div>
            <div className="precio-field">
              <label>Descuento movimientos (%)</label>
              <input type="number" step="1" min="0" max="100"
                value={Math.round((precios[u.id]?.movDesc || 0) * 100)}
                onChange={e => updateUnidad(u.id, 'movDesc', num(e.target.value) / 100)}
              />
            </div>
            <div className="precio-field">
              <label>Valor base viajes cortos (USD, hasta 300 km)</label>
              <input type="number" step="1" min="0"
                value={precios[u.id]?.valorBaseUSD || ''}
                onChange={e => updateUnidad(u.id, 'valorBaseUSD', parseFloat(e.target.value) || 0)}
              />
              <ConversorUSD usdValue={precios[u.id]?.valorBaseUSD} dolar={dolar} onChangeUSD={v => updateUnidad(u.id, 'valorBaseUSD', v)} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Movimientos en destino (USD por movimiento)
            </div>
            <div style={{ fontSize: 12, color: '#6A6A8A', marginBottom: 10, lineHeight: 1.45 }}>
              El día se cobra sumando cada movimiento que agrega el cliente: 1.º + 2.º + 3.º y siguientes (cada uno).
              {Array.isArray(precios[u.id]?.movUSD) && (
                <> Ej.: 1 mov = USD {precioMovimientosDiaUSD(precios[u.id].movUSD, 1).toFixed(2)} · 2 mov = USD {precioMovimientosDiaUSD(precios[u.id].movUSD, 2).toFixed(2)} · 3 mov = USD {precioMovimientosDiaUSD(precios[u.id].movUSD, 3).toFixed(2)}{precios[u.id]?.movDesc ? ` (antes del ${Math.round(precios[u.id].movDesc * 100)} % de descuento)` : ''}.</>
              )}
            </div>
            <div className="precios-grid">
              {[0, 1, 2].map(i => (
                <div key={i} className="precio-field">
                  <label>{['1.er movimiento del día', '2.º movimiento', '3.º y siguientes (c/u)'][i]}</label>
                  <input type="number" step="1" min="0"
                    value={precios[u.id]?.movUSD?.[i] || ''}
                    onChange={e => updateMov(u.id, i, e.target.value)}
                  />
                  <ConversorUSD usdValue={precios[u.id]?.movUSD?.[i]} dolar={dolar} onChangeUSD={v => updateMov(u.id, i, String(v))} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="precios-card">
        <div className="precios-title">⚙️ Configuración general</div>
        <div style={{ fontSize: 12, color: '#6A6A8A', margin: '6px 0 12px', lineHeight: 1.45 }}>
          Estos valores los usan los cuatro cotizadores (Charter, Receptivo, A disposición y Movimientos) apenas se guardan.
        </div>
        <div className="precios-grid">
          <div className="precio-field">
            <label>Km umbral viaje corto (valor base)</label>
            <input type="number" min="0"
              value={precios.kmBaseThreshold ?? D.kmBaseThreshold}
              onChange={e => setPrecios(prev => ({ ...prev, kmBaseThreshold: num(e.target.value, D.kmBaseThreshold) }))}
            />
          </div>
          <div className="precio-field">
            <label>Km umbral estadía (media distancia)</label>
            <input type="number" min="0"
              value={precios.kmEstadiaThreshold ?? D.kmEstadiaThreshold}
              onChange={e => setPrecios(prev => ({ ...prev, kmEstadiaThreshold: num(e.target.value, D.kmEstadiaThreshold) }))}
            />
          </div>
          <div className="precio-field">
            <label>Km incluidos por día de movimientos</label>
            <input type="number" min="0"
              value={precios.kmMovIncluidos ?? D.kmMovIncluidos}
              onChange={e => setPrecios(prev => ({ ...prev, kmMovIncluidos: num(e.target.value, D.kmMovIncluidos) }))}
            />
          </div>
          <div className="precio-field">
            <label>IVA (%)</label>
            <input type="number" step="0.5" min="0" max="100"
              value={verPorc(precios.iva, D.iva)}
              onChange={e => setPrecios(prev => ({ ...prev, iva: num(e.target.value) / 100 }))}
            />
          </div>
          <div className="precio-field">
            <label>Seña transferencia / efectivo (%)</label>
            <input type="number" step="1" min="1" max="100"
              value={verPorc(precios.senaPorc, D.senaPorc)}
              onChange={e => setPrecios(prev => ({ ...prev, senaPorc: num(e.target.value, D.senaPorc * 100) / 100 }))}
            />
          </div>
          <div className="precio-field">
            <label>Pago inicial online — MercadoPago / tarjeta (%)</label>
            <input type="number" step="1" min="1" max="100"
              value={verPorc(precios.senaOnlinePorc, D.senaOnlinePorc)}
              onChange={e => setPrecios(prev => ({ ...prev, senaOnlinePorc: num(e.target.value, D.senaOnlinePorc * 100) / 100 }))}
            />
          </div>
        </div>
      </div>

      {error && <div style={{ color: '#CF1322', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button className={`precios-save ${saved ? 'saved' : ''}`} onClick={handleSave} disabled={guardando}>
        {saved ? '✓ Precios guardados' : 'Guardar todos los precios'}
      </button>
    </div>
  );
}
