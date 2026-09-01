import React, { useState, useCallback, useEffect, useRef } from 'react';
import { KM_MOV_INCLUIDOS, BASES, baseMasCercana } from '../data/constants';

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

function calcRouteKm(origin, destination, waypoints = []) {
  return new Promise((resolve, reject) => {
    const service = new window.google.maps.DirectionsService();
    service.route({
      origin,
      destination,
      waypoints,
      travelMode: window.google.maps.TravelMode.DRIVING,
      avoidFerries: true,
      avoidTolls: false,
      avoidHighways: false,
      provideRouteAlternatives: false,
      optimizeWaypoints: false,
    }, (result, status) => {
      if (status !== 'OK') { reject(status); return; }
      // Suma TODOS los tramos (legs) — cuando hay waypoints hay un leg por tramo
      const legs = result.routes[0]?.legs;
      if (!legs || legs.length === 0) { reject('NO_LEG'); return; }
      const totalMeters = legs.reduce((sum, leg) => sum + leg.distance.value, 0);
      const km = Math.round(totalMeters / 1000);
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
  const [kmRutaIda, setKmRutaIda] = useState(null);
  const [baseSel, setBaseSel] = useState(BASES[0]);
  const [baseManual, setBaseManual] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [errorCalculo, setErrorCalculo] = useState(false);
  const [syncMode, setSyncMode] = useState(true);
  const [tabActivo, setTabActivo] = useState(flotaUnidades[0]?.id || null);
  const [diaEditando, setDiaEditando] = useState(null);
  const [puntosCarga, setPuntosCarga] = useState([]);

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

  useEffect(() => {
    if (!origenData || baseManual) return;
    setBaseSel(baseMasCercana({ lat: origenData.lat, lng: origenData.lng }));
  }, [origenData, baseManual]);

  useEffect(() => {
    if (!origenData) return;
    setKmBaseOrigen(null);
    loadGoogleMaps().then(() => {
      const base = new window.google.maps.LatLng(baseSel.coords.lat, baseSel.coords.lng);
      const origen = new window.google.maps.LatLng(origenData.lat, origenData.lng);
      calcRouteKm(base, origen)
        .then(km => setKmBaseOrigen(km))
        .catch(() => {});
    });
  }, [origenData, baseSel]);

  useEffect(() => {
    if (!origenData || !destinoData) return;
    setCalculando(true);
    setErrorCalculo(false);
    setKmRutaIda(null);

    loadGoogleMaps().then(() => {
      const origen = new window.google.maps.LatLng(origenData.lat, origenData.lng);
      const destino = new window.google.maps.LatLng(destinoData.lat, destinoData.lng);
      const waypoints = puntosCarga
        .filter(p => p.data)
        .map(p => ({
          location: new window.google.maps.LatLng(p.data.lat, p.data.lng),
          stopover: true,
        }));

      calcRouteKm(origen, destino, waypoints)
        .then(km => {
          setKmRutaIda(km);
          setCalculando(false);
        })
        .catch(() => {
          setErrorCalculo(true);
          setCalculando(false);
        });
    });
  }, [origenData, destinoData, puntosCarga]);

  const kmTotal = kmBaseOrigen && kmRutaIda
    ? (kmBaseOrigen * 2) + (kmRutaIda * 2)
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
  const grupos = {};
  currentMov.forEach((m, i) => { if (m > 0) { if (!grupos[m]) grupos[m] = []; grupos[m].push('D' + (i + 1)); } });

  const diaMovVal = diaEditando !== null ? currentMov[diaEditando] : 0;
  const diaKmVal = diaEditando !== null ? currentMovKm[diaEditando] : 0;
  const kmExtraDia = diaMovVal > 0 && diaKmVal > KM_MOV_INCLUIDOS ? diaKmVal - KM_MOV_INCLUIDOS : 0;

  const canContinue = origenData && destinoData && kmTotal > 0 && !calculando;

  const handleOrigenSelect = useCallback((data) => {
    setOrigenData(data);
    setKmRutaIda(null);
  }, []);

  const handleDestinoSelect = useCallback((data) => {
    setDestinoData(data);
    setKmRutaIda(null);
  }, []);

  function agregarPuntoCarga() {
    setPuntosCarga(prev => [...prev, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, data: null }]);
  }

  function quitarPuntoCarga(id) {
    setPuntosCarga(prev => prev.filter(p => p.id !== id));
  }

  function seleccionarPuntoCarga(id, data) {
    setPuntosCarga(prev => prev.map(p => (p.id === id ? { ...p, data } : p)));
  }

  function handleNext() {
    onNext({
      baseId: baseSel.id,
      baseNombre: baseSel.nombre,
      origen: origenData.display,
      destino: destinoData.display,
      puntosCarga: puntosCarga.filter(p => p.data).map(p => p.data.display),
      kmBaseOrigen,
      kmRutaIda,
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

      <div className="section-label">Puntos de carga adicionales (opcional)</div>
      <div style={{ marginBottom: 12 }}>
        {puntosCarga.map((p, idx) => (
          <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, background: 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Punto adicional {idx + 1}
              </div>
              <button
                type="button"
                onClick={() => quitarPuntoCarga(p.id)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14 }}
              >
                ✕
              </button>
            </div>
            <AutocompleteInput
              label="Ubicación de carga"
              placeholder="Ej: hotel, colegio, club, etc."
              onSelect={(data) => seleccionarPuntoCarga(p.id, data)}
            />
          </div>
        ))}
        <button type="button" className="btn-secondary" style={{ marginTop: 0 }} onClick={agregarPuntoCarga}>
          + Agregar punto de carga
        </button>
      </div>

      {origenData && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Base de salida {baseManual ? '· elegida por vos' : '· asignada por cercanía'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {BASES.map(b => (
              <div key={b.id}
                onClick={() => { setBaseSel(b); setBaseManual(true); }}
                style={{
                  border: `1.5px solid ${baseSel.id === b.id ? 'var(--sp)' : 'var(--border)'}`,
                  background: baseSel.id === b.id ? 'var(--spl)' : 'var(--bg)',
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'center',
                }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: baseSel.id === b.id ? 'var(--spd)' : 'var(--text)' }}>
                  🚌 {b.nombre}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>{b.zona}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          🛣️ Base {baseSel.nombre}↔Origen: <strong>{kmBaseOrigen * 2} km</strong> · Recorrido (ida y vuelta): <strong>{kmRutaIda * 2} km</strong> · <strong>Total: {kmTotal} km</strong>
          {puntosCarga.filter(p => p.data).length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
              Incluye {puntosCarga.filter(p => p.data).length} punto{puntosCarga.filter(p => p.data).length > 1 ? 's' : ''} de carga adicional{puntosCarga.filter(p => p.data).length > 1 ? 'es' : ''}.
            </div>
          )}
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
              <button className="editor-btn"
                onClick={() => setMov(diaEditando, diaMovVal + 1)}>+</button>
            </div>
          </div>
          {diaMovVal > 0 && (
            <div className="editor-km">
              <div className="editor-km-label">Km totales de movimientos este día</div>
              <div className="editor-km-row">
                <input type="number" min="0" max="9999"
                  className={`editor-km-input ${diaKmVal > KM_MOV_INCLUIDOS ? 'over' : ''}`}
                  placeholder="ej: 80"
                  value={diaKmVal || ''}
                  onChange={e => setMovKm(diaEditando, parseInt(e.target.value) || 0)}
                />
                <span className="editor-km-unit">km totales</span>
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                Hasta {KM_MOV_INCLUIDOS} km incluidos · si superan se cobran km extra
              </div>
              {kmExtraDia > 0 && (
                <div className="km-extra-alert">⚠️ +{kmExtraDia} km extra incluidos en el precio</div>
              )}
            </div>
          )}
        </div>
      )}

      {totalMov > 0 && (
        <div className="resumen-pill">
          <strong>{diasConMov} días con movimientos · {totalMov} movimientos totales</strong><br />
          {Object.entries(grupos).filter(([,v]) => v.length > 0).map(([k, v]) => (
            <span key={k}><strong>{k} mov:</strong> {v.join(', ')} · </span>
          ))}
        </div>
      )}

      <button className="btn-primary" disabled={!canContinue} onClick={handleNext}>
        Ver presupuesto →
      </button>
      <button className="btn-secondary" onClick={onBack}>← Modificar flota</button>
    </div>
  );
}
