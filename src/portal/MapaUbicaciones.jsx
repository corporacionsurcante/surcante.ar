import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { colorBus } from '../admin/egresados/utils';

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = LEAFLET_JS;
    s.onload = res;
    s.onerror = () => rej(new Error('No se pudo cargar el mapa'));
    document.head.appendChild(s);
  });
}

function tiempoDesde(date) {
  const seg = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  return `hace ${Math.floor(seg / 3600)} h`;
}

/**
 * Mapa de ubicaciones en tiempo real.
 * opId        – ID del operativo
 * busesProp   – buses ya cargados (opcional; si null los carga)
 * filtrarBusId– si se pasa, muestra solo ese bus (vista pasajero)
 * esPortal    – true = usa clases portal-*, false = inline admin
 */
export default function MapaUbicaciones({ opId, buses: busesProp = null, filtrarBusId = null, esPortal = true }) {
  const mapContainer = useRef(null);
  const mapInstance  = useRef(null);
  const markersRef   = useRef({});
  const [listo, setListo]           = useState(false);
  const [error, setError]           = useState('');
  const [ubicaciones, setUbicaciones] = useState([]);
  const [buses, setBuses]           = useState(busesProp || []);

  // Cargar buses si no llegan como prop
  useEffect(() => {
    if (busesProp !== null) { setBuses(busesProp); return; }
    getDocs(collection(db, 'operativos', opId, 'buses'))
      .then(snap => setBuses(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(e => setError(e.message));
  }, [opId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suscribir ubicaciones en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'operativos', opId, 'ubicaciones'),
      snap => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (filtrarBusId) docs = docs.filter(u => u.id === filtrarBusId);
        setUbicaciones(docs);
      },
      e => setError(e.message)
    );
    return unsub;
  }, [opId, filtrarBusId]);

  // Efecto 1: Cargar biblioteca Leaflet
  useEffect(() => {
    cargarLeaflet()
      .then(() => setListo(true))
      .catch(e => setError(e.message));
  }, []);

  // Efecto 2: Inicializar mapa DESPUÉS de que la biblioteca esté lista y el contenedor visible.
  // Al correr este efecto, el re-render ya ocurrió → el div ya tiene dimensiones reales.
  useEffect(() => {
    if (!listo || !mapContainer.current || mapInstance.current) return;
    const map = window.L.map(mapContainer.current, {
      center: [-34.6037, -58.3816],
      zoom: 13,
      zoomControl: true,
    });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapInstance.current = map;
    // Forzar recálculo de dimensiones por si el contenedor cambió de tamaño
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      mapInstance.current.remove();
      mapInstance.current = null;
      markersRef.current = {};
    };
  }, [listo]);

  // Efecto 3: Actualizar marcadores cuando cambian datos o cuando el mapa se inicializa
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.L) return;

    const busMap = {};
    buses.forEach(b => { busMap[b.id] = b; });
    const bounds = [];

    ubicaciones.forEach(ub => {
      if (!ub.lat || !ub.lng) return;
      const bus    = busMap[ub.id] || {};
      const color  = colorBus(bus) || '#7C3AED';
      const interno = bus.codigo || bus.interno || bus.numero || '';
      const patente = bus.patente || '';
      // Línea principal del ícono: interno si existe, si no patente, si no '?'
      const labelTop  = interno || patente || '?';
      // Segunda línea: patente si ya mostramos interno
      const labelSub  = interno && patente ? patente : '';
      const ts    = ub.ts?.seconds ? new Date(ub.ts.seconds * 1000) : null;
      const hace  = ts ? tiempoDesde(ts) : null;

      const popupContent = `
        <div style="font-family:Arial,sans-serif;min-width:140px">
          <div style="font-size:14px;font-weight:700;color:#1C1B2E;margin-bottom:2px">${interno || patente || 'Bus'}</div>
          ${patente && interno ? `<div style="font-size:12px;color:#888;margin-bottom:4px">${patente}</div>` : ''}
          ${bus.empresa ? `<div style="font-size:12px;color:#555;margin-bottom:4px">${bus.empresa}</div>` : ''}
          <div style="font-size:12px;color:#10B981">📡 ${hace ? `Actualizado ${hace}` : 'En línea'}</div>
          ${ub.accuracy ? `<div style="font-size:11px;color:#aaa;margin-top:2px">Precisión ±${Math.round(ub.accuracy)} m</div>` : ''}
        </div>`;

      const iconHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.30))">
          <div style="background:${color};border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;font-size:22px;line-height:1">🚌</div>
          <div style="background:${color};color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;border:1.5px solid rgba(255,255,255,.8);white-space:nowrap;font-family:Arial,sans-serif;letter-spacing:.3px;text-align:center">
            ${labelTop}${labelSub ? `<br><span style="font-weight:500;opacity:.85">${labelSub}</span>` : ''}
          </div>
        </div>`;

      bounds.push([ub.lat, ub.lng]);

      const icon = window.L.divIcon({ className: '', html: iconHtml, iconAnchor: [21, 52] });

      if (markersRef.current[ub.id]) {
        // Actualiza posición, ícono (puede haber llegado info del bus después) y popup
        markersRef.current[ub.id].setLatLng([ub.lat, ub.lng]);
        markersRef.current[ub.id].setIcon(icon);
        markersRef.current[ub.id].getPopup()?.setContent(popupContent);
      } else {
        const marker = window.L.marker([ub.lat, ub.lng], { icon })
          .bindPopup(popupContent, { maxWidth: 200 })
          .addTo(map);
        markersRef.current[ub.id] = marker;
      }
    });

    // Limpiar marcadores de buses que ya no transmiten
    Object.keys(markersRef.current).forEach(id => {
      if (!ubicaciones.find(u => u.id === id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [ubicaciones, buses, listo]); // listo en deps: re-corre cuando el mapa se inicializa

  const wrapClass = esPortal ? 'portal-section' : '';

  return (
    <div className={wrapClass}>
      {/* Contenedor del mapa — siempre en el DOM con altura fija para que Leaflet mida bien */}
      <div style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--p-sep, rgba(28,27,46,.08))',
        background: '#e8e8e8',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        height: 420,
      }}>
        <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />

        {/* Overlay de carga encima del mapa (no oculta el contenedor) */}
        {!listo && !error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#e8e8e8', color: '#888', fontSize: 14,
          }}>
            Cargando mapa…
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff5f5', color: '#DC2626', fontSize: 13, padding: 16, textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Estado de transmisión */}
      {listo && ubicaciones.length === 0 && (
        <div style={{
          background: 'var(--p-card, #fff)',
          border: '1px solid var(--p-sep, rgba(28,27,46,.08))',
          borderRadius: 16,
          padding: '20px 22px',
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--p-text-3, rgba(28,27,46,.42))',
        }}>
          🔴 {filtrarBusId
            ? 'Tu conductor aún no inició el servicio GPS'
            : 'Ningún conductor está transmitiendo en este momento'}
        </div>
      )}

      {listo && ubicaciones.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ubicaciones.map(ub => {
            const bus      = buses.find(b => b.id === ub.id) || {};
            const ts       = ub.ts?.seconds ? new Date(ub.ts.seconds * 1000) : null;
            const busColor = colorBus(bus) || '#7C3AED';
            return (
              <div key={ub.id} style={{
                flex: '1 1 160px',
                background: 'var(--p-card, #fff)',
                border: `1.5px solid ${busColor}`,
                borderRadius: 14,
                padding: '12px 16px',
                boxShadow: '0 1px 4px rgba(0,0,0,.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, color: 'var(--p-text, #1C1B2E)', fontSize: 15 }}>
                    {bus.codigo || bus.color || ub.id}
                  </span>
                  {bus.patente && (
                    <span style={{ fontSize: 11, color: 'var(--p-text-3, rgba(28,27,46,.42))', marginLeft: 'auto' }}>
                      {bus.patente}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--p-text-3, rgba(28,27,46,.42))' }}>
                  📡 En línea {ts ? `· ${tiempoDesde(ts)}` : ''}
                </div>
                {ub.accuracy && (
                  <div style={{ fontSize: 11, color: 'var(--p-text-3, rgba(28,27,46,.42))', marginTop: 2 }}>
                    Precisión ±{Math.round(ub.accuracy)} m
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
