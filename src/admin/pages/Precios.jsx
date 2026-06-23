import React, { useEffect, useState } from 'react';
import { suscribirPrecios, actualizarPrecios, inicializarPrecios } from '../../firebase/services';
import { useDolar } from '../../hooks/useDolar';

const UNIDADES = [
  { id: 'u1', nombre: 'Omnibus Mix 60', ico: '🚌' },
  { id: 'u2', nombre: 'Omnibus Común 45', ico: '🚌' },
  { id: 'u3', nombre: 'Minibus 19/24', ico: '🚐' },
];

export default function Precios() {
  const [precios, setPrecios] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const { dolar, loading: loadingDolar } = useDolar();

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

  // Conversor USD ↔ ARS completamente independiente con estado propio
  function Conversor({ usdValue, onChangeUSD }) {
    const [arsLocal, setArsLocal] = useState('');
    const [usdLocal, setUsdLocal] = useState('');
    const prevUsdRef = React.useRef(usdValue);

    // Sincronizar desde afuera SOLO cuando el valor USD cambia por otra causa
    useEffect(() => {
      if (prevUsdRef.current !== usdValue) {
        prevUsdRef.current = usdValue;
        setUsdLocal(usdValue != null ? String(usdValue) : '');
        setArsLocal(dolar && usdValue ? String(Math.round(usdValue * dolar)) : '');
      }
    }, [usdValue]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleUSDChange(val) {
      setUsdLocal(val);
      const n = parseFloat(val);
      if (!isNaN(n)) {
        setArsLocal(dolar ? String(Math.round(n * dolar)) : '');
        prevUsdRef.current = n;
        onChangeUSD(n);
      } else {
        setArsLocal('');
      }
    }

    function handleARSChange(val) {
      setArsLocal(val);
      const n = parseFloat(val);
      if (!isNaN(n) && dolar) {
        const usd = parseFloat((n / dolar).toFixed(2));
        setUsdLocal(String(usd));
        prevUsdRef.current = usd;
        onChangeUSD(usd);
      }
    }

    if (loadingDolar) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '8px 10px', background: '#F4F2FA', borderRadius: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: '#9090B0', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>USD</label>
          <input
            type="number" step="0.01" min="0"
            value={usdLocal !== '' ? usdLocal : (usdValue != null ? usdValue : '')}
            onChange={e => handleUSDChange(e.target.value)}
            style={{ border: '1.5px solid #7B2FBE', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', fontWeight: 600, color: '#4A0FA8', width: '100%' }}
          />
        </div>
        <div style={{ color: '#9090B0', fontSize: 14, fontWeight: 700, paddingTop: 16 }}>⇄</div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: '#9090B0', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>$ ARS</label>
          <input
            type="number" step="1" min="0"
            value={arsLocal !== '' ? arsLocal : (dolar && usdValue ? Math.round(usdValue * dolar) : '')}
            onChange={e => handleARSChange(e.target.value)}
            placeholder="ej: 500000"
            style={{ border: '1.5px solid #00C896', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', fontWeight: 600, color: '#007A5A', width: '100%' }}
          />
        </div>
        <div style={{ fontSize: 9, color: '#9090B0', paddingTop: 16, whiteSpace: 'nowrap' }}>
          1 USD = ${dolar ? Math.round(dolar).toLocaleString('es-AR') : '...'}
        </div>
      </div>
    );
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
              <Conversor usdValue={precios[u.id]?.usdKm} onChangeUSD={v => updateUnidad(u.id, 'usdKm', v)} />
            </div>
            <div className="precio-field">
              <label>Descuento movimientos (%)</label>
              <input type="number" step="1" min="0" max="100"
                value={((precios[u.id]?.movDesc || 0) * 100).toFixed(0)}
                onChange={e => updateUnidad(u.id, 'movDesc', parseFloat(e.target.value) / 100)}
              />
            </div>
            <div className="precio-field">
              <label>Valor base viajes cortos (USD, hasta 300 km)</label>
              <input type="number" step="1" min="0"
                value={precios[u.id]?.valorBaseUSD || ''}
                onChange={e => updateUnidad(u.id, 'valorBaseUSD', parseFloat(e.target.value) || 0)}
              />
              <Conversor usdValue={precios[u.id]?.valorBaseUSD} onChangeUSD={v => updateUnidad(u.id, 'valorBaseUSD', v)} />
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
                  <Conversor usdValue={precios[u.id]?.movUSD?.[i]} />
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
            <label>Km umbral viaje corto (valor base)</label>
            <input type="number" min="0"
              value={precios.kmBaseThreshold || 300}
              onChange={e => setPrecios(prev => ({ ...prev, kmBaseThreshold: parseInt(e.target.value) }))}
            />
          </div>
          <div className="precio-field">
            <label>Km umbral estadía (media distancia)</label>
            <input type="number" min="0"
              value={precios.kmEstadiaThreshold || 800}
              onChange={e => setPrecios(prev => ({ ...prev, kmEstadiaThreshold: parseInt(e.target.value) }))}
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
