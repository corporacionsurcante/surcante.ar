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
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [ubicaciones, setUbicaciones] = useState([]);
  const [buses, setBuses] = useState(busesProp || []);

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

  // Inicializar mapa Leaflet una sola vez
  useEffect(() => {
    cargarLeaflet()
      .then(() => {
        setCargando(false);
        if (!mapContainer.current || mapInstance.current) return;
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
      })
      .catch(e => { setError(e.message); setCargando(false); });
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current = {};
      }
    };
  }, []); // solo al montar

  // Actualizar marcadores cuando cambian los datos
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.L) return;

    const busMap = {};
    buses.forEach(b => { busMap[b.id] = b; });

    const bounds = [];

    ubicaciones.forEach(ub => {
      if (!ub.lat || !ub.lng) return;
      const bus   = busMap[ub.id] || {};
      const color = colorBus(bus) || '#7C3AED';
      const label = bus.codigo || bus.color || ub.id;
      const ts    = ub.ts?.seconds ? new Date(ub.ts.seconds * 1000) : null;
      const hace  = ts ? tiempoDesde(ts) : null;

      const popupContent = `<b style="font-size:13px">${label}</b><br>
        <span style="font-size:12px;color:#555">${[bus.empresa, bus.patente].filter(Boolean).join(' · ')}</span><br>
        <span style="font-size:12px">📡 ${hace ? `Actualizado ${hace}` : 'En línea'}</span>
        ${ub.accuracy ? `<br><span style="font-size:11px;color:#888">Precisión ±${Math.round(ub.accuracy)} m</span>` : ''}`;

      bounds.push([ub.lat, ub.lng]);

      if (markersRef.current[ub.id]) {
        markersRef.current[ub.id].setLatLng([ub.lat, ub.lng]);
        markersRef.current[ub.id].getPopup()?.setContent(popupContent);
      } else {
        const icon = window.L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#fff;font-size:11px;font-weight:700;padding:5px 10px;border-radius:20px;border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);white-space:nowrap;font-family:Arial,sans-serif">${label}</div>`,
          iconAnchor: [24, 14],
        });
        const marker = window.L.marker([ub.lat, ub.lng], { icon })
          .bindPopup(popupContent)
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
  }, [ubicaciones, buses]);

  const wrapClass = esPortal ? 'portal-section' : '';

  return (
    <div className={wrapClass}>
      {/* Mapa */}
      <div style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--p-sep, rgba(28,27,46,.08))',
        background: '#e8e8e8',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      }}>
        {cargando && (
          <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
            Cargando mapa…
          </div>
        )}
        {error && (
          <div style={{ padding: 16, color: '#DC2626', fontSize: 13 }}>⚠️ {error}</div>
        )}
        <div ref={mapContainer} style={{ height: 420, width: '100%', display: cargando ? 'none' : 'block' }} />
      </div>

      {/* Estado de transmisión */}
      {!cargando && ubicaciones.length === 0 && (
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

      {!cargando && ubicaciones.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ubicaciones.map(ub => {
            const bus   = buses.find(b => b.id === ub.id) || {};
            const ts    = ub.ts?.seconds ? new Date(ub.ts.seconds * 1000) : null;
            const color = colorBus(bus) || '#7C3AED';
            return (
              <div key={ub.id} style={{
                flex: '1 1 160px',
                background: 'var(--p-card, #fff)',
                border: '1px solid var(--p-sep, rgba(28,27,46,.08))',
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
