import React, { useState, useEffect } from 'react';
import { getDiasServicio } from '../utils/calculos';
import Calendario from '../components/Calendario';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { suscribirPrecios } from '../firebase/services';

// Respaldo si no se puede leer config/precios (valores cargados en el admin a jun-2026)
const TIPO_UNIT_DEFAULT = {
  'MIX 60':    { usdKm: 2.16, movDesc: 0, movUSD: [303.69, 269.94, 236.20], valorBaseUSD: 506.14 },
  'Comun 45':  { usdKm: 2.02, movDesc: 0, movUSD: [303.69, 236.20, 202.46], valorBaseUSD: 506.14 },
  'Minibus 24':{ usdKm: 1.89, movDesc: 0, movUSD: [269.94, 202.46, 134.97], valorBaseUSD: 472.40 },
  'Minibus 19':{ usdKm: 1.89, movDesc: 0, movUSD: [269.94, 202.46, 134.97], valorBaseUSD: 472.40 },
};

// Mapeo tipo → id Firebase
const TIPO_TO_ID = { 'MIX 60': 'u1', 'Comun 45': 'u2', 'Minibus 24': 'u3', 'Minibus 19': 'u3' };

// Devuelve { precios, cargado }: el botón Continuar espera a tener los precios
// (si no, la cotización saldría con los valores de respaldo).
function usePreciosFirebase() {
  const [estado, setEstado] = useState({ precios: null, cargado: false });
  useEffect(() => suscribirPrecios(
    data => setEstado({ precios: data, cargado: true }),
    () => setEstado({ precios: null, cargado: true }),
  ), []);
  return estado;
}

function numOr(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function getTipoConfig(tipo, preciosDB) {
  const def = TIPO_UNIT_DEFAULT[tipo] || TIPO_UNIT_DEFAULT['Comun 45'];
  const id = TIPO_TO_ID[tipo];
  const p = preciosDB && id ? preciosDB[id] : null;
  if (!p) return def;
  const movDesc = Number(p.movDesc);
  return {
    usdKm: numOr(p.usdKm, def.usdKm),
    movDesc: Number.isFinite(movDesc) && movDesc >= 0 && movDesc < 1 ? movDesc : 0,
    movUSD: Array.isArray(p.movUSD) && p.movUSD.length ? p.movUSD.map(Number) : def.movUSD,
    valorBaseUSD: numOr(p.valorBaseUSD, def.valorBaseUSD),
  };
}

export default function PasoFlota({ onNext }) {
  const { precios: preciosDB, cargado: preciosCargados } = usePreciosFirebase();
  const [fechas, setFechas] = useState({ fechaInicio: '', fechaFin: '', mismodia: false, horaInicio: null, horaFin: null });
  const [qty, setQty] = useState({});

  const { disponibilidad, loading, errorDisponibilidad } = useDisponibilidad(fechas.fechaInicio, fechas.fechaFin);

  const dias = fechas.mismodia ? 1 : getDiasServicio(fechas.fechaInicio, fechas.fechaFin);
  // Solo cuentan las unidades elegidas que siguen disponibles para las fechas actuales
  const totalUnidades = disponibilidad.reduce((a, u) => a + ((u.disponible || !fechas.fechaInicio) ? (qty[u.id] || 0) : 0), 0);
  const canContinue = fechas.fechaInicio && fechas.fechaFin && totalUnidades > 0 && preciosCargados;

  // Cada tarjeta es un ómnibus físico (un interno): se contrata 0 o 1 vez
  function chQty(uid, d) {
    setQty(prev => ({ ...prev, [uid]: Math.min(1, Math.max(0, (prev[uid] || 0) + d)) }));
  }

  function buildFlota() {
    const flota = [];
    disponibilidad.forEach(u => {
      if (fechas.fechaInicio && !u.disponible) return;
      const cant = qty[u.id] || 0;
      for (let i = 0; i < cant; i++) {
        const config = getTipoConfig(u.tipo, preciosDB);
        flota.push({
          id: `${u.id}_${i}`,
          tid: u.id,
          type: {
            ...config,
            name: `${u.tipo} (${u.interno})`,
            icon: u.butacas >= 45 ? '🚌' : '🚐',
            seats: u.butacas,
            tipoNombre: u.tipo,
          },
          label: `INTERNO ${u.interno} · ${u.patente}${cant > 1 ? ` #${i+1}` : ''}`,
          unidadId: u.id,
        });
      }
    });
    return flota;
  }

  function handleContinue() {
    onNext({
      fechaInicio: fechas.fechaInicio,
      fechaFin: fechas.fechaFin,
      mismodia: fechas.mismodia,
      horaInicio: fechas.horaInicio,
      horaFin: fechas.horaFin,
      dias,
      qty,
      flotaUnidades: buildFlota(),
    });
  }

  const flotaDesc = disponibilidad
    .filter(u => (qty[u.id] || 0) > 0 && (u.disponible || !fechas.fechaInicio))
    .map(u => `${qty[u.id]}× Int.${u.interno}`)
    .join(' + ');

  const grupos = {};
  disponibilidad.forEach(u => {
    if (!grupos[u.tipo]) grupos[u.tipo] = [];
    grupos[u.tipo].push(u);
  });

  return (
    <div className="body">
      <div className="section-label">Fechas del viaje</div>
      <Calendario onChange={setFechas} />

      <div className="divider" />
      <div className="section-label">
        Unidades disponibles{dias > 0 ? ` · ${dias} día${dias !== 1 ? 's' : ''} de servicio` : fechas.mismodia ? ' · viaje en el día' : ''}
      </div>

      {loading && fechas.fechaInicio && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
          ⏳ Verificando disponibilidad...
        </div>
      )}

      {errorDisponibilidad && fechas.fechaInicio && (
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
          ⚠️ No pudimos verificar la disponibilidad en este momento. Podés cotizar igual: la confirmamos por WhatsApp.
        </div>
      )}

      {!loading && disponibilidad.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
          No hay unidades registradas en el sistema.
        </div>
      )}

      {Object.entries(grupos).map(([tipo, units]) => (
        <div key={tipo}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
            {tipo}
          </div>
          {units.map(u => {
            const cant = qty[u.id] || 0;
            const disponible = !fechas.fechaInicio || u.disponible;
            return (
              <div key={u.id} className={`unit-card ${cant > 0 ? 'selected' : ''} ${!disponible ? 'unavailable' : ''}`}>
                <div className="unit-card-header">
                  <div className="unit-ico">{u.butacas >= 45 ? '🚌' : '🚐'}</div>
                  <div className="unit-info">
                    <div className="unit-name">INTERNO {u.interno} · {u.patente}</div>
                    <div className="unit-detail">{u.butacas} butacas · {u.empresa?.toUpperCase()}</div>
                  </div>
                  <span className={`badge ${!fechas.fechaInicio ? 'badge-avail' : disponible ? 'badge-avail' : 'badge-unavail'}`}>
                    {!fechas.fechaInicio ? 'Seleccioná fechas' : disponible ? 'Disponible' : 'Ocupado'}
                  </span>
                </div>
                {disponible && (
                  <div className="qty-row">
                    <span className="qty-label">Cantidad a contratar</span>
                    <div className="counter">
                      <button className="counter-btn" disabled={cant === 0} onClick={() => chQty(u.id, -1)}>−</button>
                      <span className="counter-val">{cant}</span>
                      <button className="counter-btn" disabled={cant >= 1} onClick={() => chQty(u.id, 1)}>+</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {totalUnidades > 0 && (
        <div className="flota-pill">🚌 <strong>Flota:</strong> {flotaDesc}</div>
      )}

      <button className="btn-primary" disabled={!canContinue} onClick={handleContinue}>
        {preciosCargados ? 'Continuar →' : 'Cargando tarifas...'}
      </button>
    </div>
  );
}
