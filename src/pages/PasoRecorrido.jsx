import React, { useState, useCallback, useEffect, useRef } from 'react';
import { KM_MOV_INCLUIDOS, BASE_COORDS } from '../data/constants';

const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) { resolve(); return; }
    if (document.getElementById('gmap-script')) {
      document.getElementById('gmap-script').addEventListener('load', resolve);
      return;
    }
    const s = document.createElement('script');
    s.id = 'gmap-script';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Usa Directions API para obtener la ruta más rápida (igual que Google Maps)
// avoidFerries: true, avoidHighways: false = usa autopistas, sin ferries
function calcRouteKm(origin, destination) {
  return new Promise((resolve, reject) => {
    const service = new window.google.maps.DirectionsService();
    service.route({
      origin,
      destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
      avoidFerries: true,
      avoidTolls: false,
      avoidHighways: false,
      provideRouteAlternatives: false,
      optimizeWaypoints: false,
    }, (result, status) => {
      if (status !== 'OK') { reject(status); return; }
      // Toma la primera ruta (la más rápida, igual que Google Maps)
      const leg = result.routes[0]?.legs[0];
      if (!leg) { reject('NO_LEG'); return; }
      const km = Math.round(leg.distance.value / 1000);
      resolve(km);
    });
  });
}

function AutocompleteInput({ placeholder, label, onSelect }) {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!MAPS_KEY) return;
    loadGoogleMaps().then(() => {
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['geometry', 'formatted_address', 'name'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry) return;
        const loc = place.geometry.location;
        const display = place.name || place.formatted_address;
        setValue(display);
        onSelect({ lat: loc.lat(), lng: loc.lng(), display, placeId: place.place_id });
      });
    }).catch(() => {});
  }, [onSelect]);

  return (
    <div className="ruta-field">
      <label>{label}</label>
      <input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </div>
  );
}

export default function PasoRecorrido({ reserva, onNext, onBack }) {
  const { dias, flotaUnidades } = reserva;
  const [origenData, setOrigenData] = useState(null);
  const [destinoData, setDestinoData] = useState(null);
  const [kmBaseOrigen, setKmBaseOrigen] = useState(null);
  const [kmOrigenDestino, setKmOrigenDestino] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [errorCalculo, setErrorCalculo] = useState(false);
  const [syncMode, setSyncMode] = useState(true);
  const [tabActivo, setTabActivo] = useState(flotaUnidades[0]?.id || null);
  const [diaEditando, setDiaEditando] = useState(null);

  const [movData, setMovData] = useState(() => {
    const d = { '_sync': Array(dias || 1).fill(0) };
    flotaUnidades.forEach(u => { d[u.id] = Array(dias || 1).fill(0); });
    return d;
  });
  const [movKmData, setMovKmData] = useState(() => {
    const d = { '_sync': Array(dias || 1).fill(0) };
    flotaUnidades.forEach(u => { d[u.id] = Array(dias || 1).fill(0); });
    return d;
  });

  // Calcula base→origen apenas se selecciona el origen
  useEffect(() => {
    if (!origenData) return;
    setKmBaseOrigen(null);
    loadGoogleMaps().then(() => {
      const base = new window.google.maps.LatLng(BASE_COORDS.lat, BASE_COORDS.lng);
      const origen = new window.google.maps.LatLng(origenData.lat, origenData.lng);
      calcRouteKm(base, origen)
        .then(km => setKmBaseOrigen(km))
        .catch(() => {});
    });
  }, [origenData]);

  // Calcula origen→destino cuando están ambos
  useEffect(() => {
    if (!origenData || !destinoData) return;
    setCalculando(true);
    setErrorCalculo(false);
    setKmOrigenDestino(null);

    loadGoogleMaps().then(() => {
      const origen = new window.google.maps.LatLng(origenData.lat, origenData.lng);
      const destino = new window.google.maps.LatLng(destinoData.lat, destinoData.lng);
      calcRouteKm(origen, destino)
        .then(km => {
          setKmOrigenDestino(km);
          setCalculando(false);
        })
        .catch(() => {
          setErrorCalculo(true);
          setCalculando(false);
        });
    });
  }, [origenData, destinoData]);

  const kmTotal = kmBaseOrigen && kmOrigenDestino
    ? (kmBaseOrigen * 2) + (kmOrigenDestino * 2)
    : null;

  const key = syncMode ? '_sync' : (tabActivo || '_sync');
  const currentMov = movData[key] || Array(dias).fill(0);
  const currentMovKm = movKmData[key] || Array(dias).fill(0);

  const setMov = useCallback((idx, val) => {
    setMovData(prev => ({ ...prev, [key]: prev[key].map((v, i) => i === idx ? val : v) }));
  }, [key]);

  const setMovKm = useCallback((idx, val) => {
    setMovKmData(prev => ({ ...prev, [key]: prev[key].map((v, i) => i === idx ? val : v) }));
  }, [key]);

  const totalMov = currentMov.reduce((a, b) => a + b, 0);
  const diasConMov = currentMov.filter(x => x > 0).length;
  const grupos = { 1: [], 2: [], 3: [] };
  currentMov.forEach((m, i) => { if (m > 0 && m <= 3) grupos[m].push('D' + (i + 1)); });

  const diaMovVal = diaEditando !== null ? currentMov[diaEditando] : 0;
  const diaKmVal = diaEditando !== null ? currentMovKm[diaEditando] : 0;
  const kmExtra = diaMovVal > 0 ? Math.max(0, diaKmVal - KM_MOV_INCLUIDOS) * diaMovVal : 0;

  const canContinue = origenData && destinoData && kmTotal > 0 && !calculando;

  const handleOrigenSelect = useCallback((data) => {
    setOrigenData(data);
    setKmOrigenDestino(null);
  }, []);

  const handleDestinoSelect = useCallback((data) => {
    setDestinoData(data);
    setKmOrigenDestino(null);
  }, []);

  function handleNext() {
    onNext({
      origen: origenData.display,
      destino: destinoData.display,
      kmBaseOrigen,
      kmOrigenDestino,
      kmTotal,
      syncMode, movData, movKmData,
    });
  }

  return (
    <div className="body">
      <div className="section-label">Origen y destino del viaje</div>
      <div className="ruta-box">
        <div className="ruta-row">
          <div className="ruta-dot origen">📍</div>
          <AutocompleteInput
            label="Punto de carga del contingente"
            placeholder="Ciudad o dirección de origen"
            onSelect={handleOrigenSelect}
          />
        </div>
        <div className="ruta-row">
          <div className="ruta-dot destino">🏁</div>
          <AutocompleteInput
            label="Destino del viaje"
            placeholder="Ciudad o dirección de destino"
            onSelect={handleDestinoSelect}
          />
        </div>
      </div>

      {calculando && (
        <div className="km-pill" style={{ color: 'var(--sp)' }}>
          ⏳ Calculando ruta real...
        </div>
      )}

      {errorCalculo && (
        <div className="km-pill" style={{ background: 'var(--red-bg)', color: 'var(--red-text)' }}>
          ⚠️ No se pudo calcular la ruta. Verificá los puntos ingresados.
        </div>
      )}

      {kmTotal && !calculando && (
        <div className="km-pill">
          🛣️ Base↔Origen: <strong>{kmBaseOrigen * 2} km</strong> · Origen↔Destino: <strong>{kmOrigenDestino * 2} km</strong> · <strong>Total: {kmTotal} km</strong>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
            Ruta más rápida · sin ferries · apto omnibus
          </div>
        </div>
      )}

      <div className="divider" />
      <div className="section-label">Movimientos en destino</div>

      <div className={`sync-toggle ${syncMode ? 'on' : ''}`}
        onClick={() => { setSyncMode(s => !s); setDiaEditando(null); }}>
        <div className="toggle-track"><div className="toggle-thumb" /></div>
        <span className="toggle-text">Todas las unidades hacen los mismos movimientos</span>
      </div>

      {!syncMode && flotaUnidades.length > 1 && (
        <div className="tabs-wrap">
          {flotaUnidades.map(u => (
            <div key={u.id} className={`tab ${tabActivo === u.id ? 'active' : ''}`}
              onClick={() => { setTabActivo(u.id); setDiaEditando(null); }}>
              {u.type.icon} {u.label}
            </div>
          ))}
        </div>
      )}

      <div className="hint">
        {syncMode
          ? 'Configurando para todas las unidades'
          : `Configurando: ${flotaUnidades.find(u => u.id === tabActivo)?.label || ''}`}
      </div>

      <div className="grid-dias">
        {Array.from({ length: dias || 1 }, (_, i) => {
          const m = currentMov[i];
          return (
            <div key={i}
              className={`dia-chip ${m > 0 ? 'activo' : ''} ${diaEditando === i ? 'editando' : ''}`}
              onClick={() => setDiaEditando(diaEditando === i ? null : i)}>
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
              Día {diaEditando + 1}
              {syncMode
                ? ' — todas las unidades'
                : ` — ${flotaUnidades.find(u => u.id === tabActivo)?.label || ''}`}
            </span>
            <button className="editor-close" onClick={() => setDiaEditando(null)}>✕</button>
          </div>
          <div className="editor-counter">
            <span className="editor-hint">movimientos este día</span>
            <div className="editor-ctrl">
              <button className="editor-btn" disabled={diaMovVal === 0}
                onClick={() => { setMov(diaEditando, diaMovVal - 1); if (diaMovVal - 1 === 0) setMovKm(diaEditando, 0); }}>−</button>
              <span className="editor-val">{diaMovVal}</span>
              <button className="editor-btn" disabled={diaMovVal >= 3}
                onClick={() => setMov(diaEditando, diaMovVal + 1)}>+</button>
            </div>
          </div>
          {diaMovVal > 0 && (
            <div className="editor-km">
              <div className="editor-km-label">Km por movimiento en destino (opcional)</div>
              <div className="editor-km-row">
                <input type="number" min="0" max="999"
                  className={`editor-km-input ${diaKmVal > KM_MOV_INCLUIDOS ? 'over' : ''}`}
                  placeholder="ej: 40"
                  value={diaKmVal || ''}
                  onChange={e => setMovKm(diaEditando, parseInt(e.target.value) || 0)}
                />
                <span className="editor-km-unit">km por mov.</span>
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                50 km incluidos · km extra se cobra al valor del viaje
              </div>
              {kmExtra > 0 && (
                <div className="km-extra-alert">⚠️ +{kmExtra} km extra a cotizar</div>
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
