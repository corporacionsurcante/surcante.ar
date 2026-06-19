import React, { useState, useCallback } from 'react';
import { KM_MOV_INCLUIDOS } from '../data/constants';

// KM FIJOS DE EJEMPLO — en producción se calculan con Google Maps API
// Base (Lomas del Mirador) → Origen ingresado por el cliente
const KM_BASE_A_ORIGEN_EJEMPLO = 300;

export default function PasoRecorrido({ reserva, onNext, onBack }) {
  const { nights, flotaUnidades } = reserva;
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [kmBaseOrigen] = useState(KM_BASE_A_ORIGEN_EJEMPLO);
  const [kmOrigenDestino, setKmOrigenDestino] = useState('');
  const [syncMode, setSyncMode] = useState(true);
  const [tabActivo, setTabActivo] = useState(flotaUnidades[0]?.id || null);
  const [diaEditando, setDiaEditando] = useState(null);

  // movData: { '_sync': [0,0,...], 'u1_0': [...], ... }
  const [movData, setMovData] = useState(() => {
    const d = { '_sync': Array(nights).fill(0) };
    flotaUnidades.forEach(u => { d[u.id] = Array(nights).fill(0); });
    return d;
  });
  const [movKmData, setMovKmData] = useState(() => {
    const d = { '_sync': Array(nights).fill(0) };
    flotaUnidades.forEach(u => { d[u.id] = Array(nights).fill(0); });
    return d;
  });

  const key = syncMode ? '_sync' : (tabActivo || '_sync');
  const currentMov = movData[key] || Array(nights).fill(0);
  const currentMovKm = movKmData[key] || Array(nights).fill(0);

  const setMov = useCallback((idx, val) => {
    setMovData(prev => ({ ...prev, [key]: prev[key].map((v, i) => i === idx ? val : v) }));
  }, [key]);

  const setMovKm = useCallback((idx, val) => {
    setMovKmData(prev => ({ ...prev, [key]: prev[key].map((v, i) => i === idx ? val : v) }));
  }, [key]);

  const kmOD = parseFloat(kmOrigenDestino) || 0;
  const kmTotal = kmOD > 0 ? (kmBaseOrigen * 2) + (kmOD * 2) : null;

  const totalMov = currentMov.reduce((a, b) => a + b, 0);
  const diasConMov = currentMov.filter(x => x > 0).length;

  const grupos = { 1: [], 2: [], 3: [] };
  currentMov.forEach((m, i) => { if (m > 0 && m <= 3) grupos[m].push('D' + (i + 1)); });

  const canContinue = origen.trim() && destino.trim() && kmOD > 0;

  function handleNext() {
    onNext({
      origen, destino,
      kmBaseOrigen, kmOrigenDestino: kmOD,
      kmTotal,
      syncMode, movData, movKmData,
    });
  }

  const diaMovVal = diaEditando !== null ? currentMov[diaEditando] : 0;
  const diaKmVal = diaEditando !== null ? currentMovKm[diaEditando] : 0;
  const kmExtra = diaMovVal > 0 ? Math.max(0, diaKmVal - KM_MOV_INCLUIDOS) * diaMovVal : 0;

  return (
    <div className="body">
      <div className="section-label">Origen y destino del viaje</div>
      <div className="ruta-box">
        <div className="ruta-row">
          <div className="ruta-dot origen">📍</div>
          <div className="ruta-field">
            <label>Punto de carga del contingente</label>
            <input
              placeholder="Ciudad o dirección de origen"
              value={origen}
              onChange={e => setOrigen(e.target.value)}
            />
          </div>
        </div>
        <div className="ruta-row">
          <div className="ruta-dot destino">🏁</div>
          <div className="ruta-field">
            <label>Destino del viaje</label>
            <input
              placeholder="Ciudad o dirección de destino"
              value={destino}
              onChange={e => setDestino(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="section-label" style={{ marginBottom: 6 }}>Distancia origen → destino (km)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            min="1"
            placeholder="ej: 400"
            value={kmOrigenDestino}
            onChange={e => setKmOrigenDestino(e.target.value)}
            style={{
              flex: 1, border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
              outline: 'none', color: 'var(--text)',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>km</span>
        </div>
        <div className="hint" style={{ marginTop: 4 }}>
          ⚡ En producción se calcula automáticamente con Google Maps
        </div>
      </div>

      {kmTotal && (
        <div className="km-pill">
          🛣️ Recorrido total: <strong>{kmBaseOrigen * 2} km</strong> (base↔origen) + <strong>{kmOD * 2} km</strong> (origen↔destino) = <strong>{kmTotal} km</strong>
        </div>
      )}

      <div className="divider" />
      <div className="section-label">Movimientos en destino</div>

      <div className={`sync-toggle ${syncMode ? 'on' : ''}`} onClick={() => { setSyncMode(s => !s); setDiaEditando(null); }}>
        <div className="toggle-track"><div className="toggle-thumb" /></div>
        <span className="toggle-text">Todas las unidades hacen los mismos movimientos</span>
      </div>

      {!syncMode && flotaUnidades.length > 1 && (
        <div className="tabs-wrap">
          {flotaUnidades.map(u => (
            <div
              key={u.id}
              className={`tab ${tabActivo === u.id ? 'active' : ''}`}
              onClick={() => { setTabActivo(u.id); setDiaEditando(null); }}
            >
              {u.type.icon} {u.label}
            </div>
          ))}
        </div>
      )}

      <div className="hint">
        {syncMode ? 'Configurando para todas las unidades' : `Configurando: ${flotaUnidades.find(u => u.id === tabActivo)?.label || ''}`}
      </div>

      <div className="grid-dias">
        {Array.from({ length: nights }, (_, i) => {
          const m = currentMov[i];
          return (
            <div
              key={i}
              className={`dia-chip ${m > 0 ? 'activo' : ''} ${diaEditando === i ? 'editando' : ''}`}
              onClick={() => setDiaEditando(diaEditando === i ? null : i)}
            >
              <div className="dia-chip-num">D{i + 1}</div>
              <div className="dia-chip-mov">{m === 0 ? '—' : m}</div>
              <div className="dia-chip-lbl">{m === 0 ? '·' : m === 1 ? 'mov' : 'movs'}</div>
            </div>
          );
        })}
      </div>

      {diaEditando !== null && (
        <div className="editor-panel">
          <div className="editor-header">
            <span className="editor-title">
              Día {diaEditando + 1}{syncMode ? ' — todas las unidades' : ` — ${flotaUnidades.find(u => u.id === tabActivo)?.label || ''}`}
            </span>
            <button className="editor-close" onClick={() => setDiaEditando(null)}>✕</button>
          </div>
          <div className="editor-counter">
            <span className="editor-hint">movimientos este día</span>
            <div className="editor-ctrl">
              <button className="editor-btn" disabled={diaMovVal === 0} onClick={() => { setMov(diaEditando, diaMovVal - 1); if (diaMovVal - 1 === 0) setMovKm(diaEditando, 0); }}>−</button>
              <span className="editor-val">{diaMovVal}</span>
              <button className="editor-btn" disabled={diaMovVal >= 3} onClick={() => setMov(diaEditando, diaMovVal + 1)}>+</button>
            </div>
          </div>
          {diaMovVal > 0 && (
            <div className="editor-km">
              <div className="editor-km-label">Km por movimiento en destino (opcional)</div>
              <div className="editor-km-row">
                <input
                  type="number" min="0" max="999"
                  className={`editor-km-input ${diaKmVal > KM_MOV_INCLUIDOS ? 'over' : ''}`}
                  placeholder="ej: 40"
                  value={diaKmVal || ''}
                  onChange={e => setMovKm(diaEditando, parseInt(e.target.value) || 0)}
                />
                <span className="editor-km-unit">km por mov.</span>
              </div>
              <div className="hint" style={{ marginTop: 4 }}>50 km incluidos · km extra se cobra al valor del viaje</div>
              {kmExtra > 0 && (
                <div className="km-extra-alert">⚠️ +{kmExtra} km extra a cotizar (supera los 50 km incluidos)</div>
              )}
            </div>
          )}
        </div>
      )}

      {totalMov > 0 && (
        <div className="resumen-pill">
          <strong>{diasConMov} días con movimientos · {totalMov} movimientos totales</strong><br />
          {grupos[1].length > 0 && <span><strong>1 mov:</strong> {grupos[1].join(', ')} · </span>}
          {grupos[2].length > 0 && <span><strong>2 mov:</strong> {grupos[2].join(', ')} · </span>}
          {grupos[3].length > 0 && <span><strong>3 mov:</strong> {grupos[3].join(', ')}</span>}
        </div>
      )}

      <button className="btn-primary" disabled={!canContinue} onClick={handleNext}>
        Ver presupuesto →
      </button>
      <button className="btn-secondary" onClick={onBack}>← Modificar flota</button>
    </div>
  );
}
