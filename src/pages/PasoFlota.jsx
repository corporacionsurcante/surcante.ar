import React, { useState } from 'react';
import { getDiasServicio } from '../utils/calculos';
import Calendario from '../components/Calendario';
import { useDisponibilidad } from '../hooks/useDisponibilidad';

const TIPO_UNIT = {
  'MIX 60':    { usdKm: 2.50, movDesc: 0,    movUSD: [110,170,250] },
  'Comun 45':  { usdKm: 2.00, movDesc: 0.20, movUSD: [110,170,250] },
  'Minibus 24':{ usdKm: 1.80, movDesc: 0.30, movUSD: [110,170,250] },
  'Minibus 19':{ usdKm: 1.80, movDesc: 0.30, movUSD: [110,170,250] },
};

function getTipoConfig(tipo) {
  return TIPO_UNIT[tipo] || TIPO_UNIT['Comun 45'];
}

export default function PasoFlota({ onNext }) {
  const [fechas, setFechas] = useState({ fechaInicio: '', fechaFin: '', mismodia: false, horaInicio: null, horaFin: null });
  const [qty, setQty] = useState({});

  const { disponibilidad, loading } = useDisponibilidad(fechas.fechaInicio, fechas.fechaFin);

  const dias = fechas.mismodia ? 1 : getDiasServicio(fechas.fechaInicio, fechas.fechaFin);
  const totalUnidades = Object.values(qty).reduce((a, b) => a + b, 0);
  const canContinue = fechas.fechaInicio && fechas.fechaFin && totalUnidades > 0;

  function chQty(uid, d) {
    setQty(prev => ({ ...prev, [uid]: Math.max(0, (prev[uid] || 0) + d) }));
  }

  function buildFlota() {
    const flota = [];
    disponibilidad.forEach(u => {
      const cant = qty[u.id] || 0;
      for (let i = 0; i < cant; i++) {
        const config = getTipoConfig(u.tipo);
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
          label: `Int. ${u.interno} · ${u.patente}${cant > 1 ? ` #${i+1}` : ''}`,
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
    .filter(u => (qty[u.id] || 0) > 0)
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
        Unidades disponibles{dias > 0 ? ` · ${dias} noche${dias !== 1 ? 's' : ''}` : fechas.mismodia ? ' · viaje en el día' : ''}
      </div>

      {loading && fechas.fechaInicio && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
          ⏳ Verificando disponibilidad...
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
                    <div className="unit-name">Int. {u.interno} · {u.patente}</div>
                    <div className="unit-detail">{u.butacas} butacas · {u.empresa}</div>
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
                      <button className="counter-btn" onClick={() => chQty(u.id, 1)}>+</button>
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
        Continuar →
      </button>
    </div>
  );
}
