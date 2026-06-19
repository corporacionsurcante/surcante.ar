import React, { useState } from 'react';
import { UNIT_TYPES } from '../data/constants';
import { getNights } from '../utils/calculos';
import Calendario from '../components/Calendario';

const DISPONIBILIDAD = { u1: 3, u2: 2, u3: 4 };

export default function PasoFlota({ onNext }) {
  const [fechas, setFechas] = useState({ fechaInicio: '', fechaFin: '' });
  const [qty, setQty] = useState({ u1: 0, u2: 0, u3: 0 });

  const nights = getNights(fechas.fechaInicio, fechas.fechaFin);
  const totalUnidades = qty.u1 + qty.u2 + qty.u3;
  const canContinue = fechas.fechaInicio && fechas.fechaFin && totalUnidades > 0;

  function chQty(tid, d) {
    setQty(prev => ({
      ...prev,
      [tid]: Math.max(0, Math.min(DISPONIBILIDAD[tid], prev[tid] + d))
    }));
  }

  function buildFlota() {
    const flota = [];
    ['u1', 'u2', 'u3'].forEach(tid => {
      for (let i = 0; i < qty[tid]; i++) {
        flota.push({
          id: `${tid}_${i}`,
          tid,
          type: UNIT_TYPES[tid],
          label: UNIT_TYPES[tid].name + (qty[tid] > 1 ? ` #${i + 1}` : ''),
        });
      }
    });
    return flota;
  }

  function handleContinue() {
    onNext({
      fechaInicio: fechas.fechaInicio,
      fechaFin: fechas.fechaFin,
      nights,
      qty,
      flotaUnidades: buildFlota()
    });
  }

  const flotaDesc = [
    qty.u1 > 0 && `${qty.u1}× OmPrem`,
    qty.u2 > 0 && `${qty.u2}× OmEst`,
    qty.u3 > 0 && `${qty.u3}× Minibus`,
  ].filter(Boolean).join(' + ');

  return (
    <div className="body">
      <div className="section-label">Fechas del viaje</div>
      <Calendario onChange={setFechas} />

      <div className="divider" />
      <div className="section-label">Seleccioná tu flota</div>

      {Object.values(UNIT_TYPES).map(u => (
        <div key={u.id} className={`unit-card ${qty[u.id] > 0 ? 'selected' : ''}`}>
          <div className="unit-card-header">
            <div className="unit-ico">{u.icon}</div>
            <div className="unit-info">
              <div className="unit-name">{u.name}</div>
              <div className="unit-detail">{u.seats} butacas · {u.features}</div>
            </div>
            <span className="badge badge-avail">{DISPONIBILIDAD[u.id]} dispon.</span>
          </div>
          <div className="qty-row">
            <span className="qty-label">Cantidad a contratar</span>
            <div className="counter">
              <button className="counter-btn" disabled={qty[u.id] === 0} onClick={() => chQty(u.id, -1)}>−</button>
              <span className="counter-val">{qty[u.id]}</span>
              <button className="counter-btn" disabled={qty[u.id] >= DISPONIBILIDAD[u.id]} onClick={() => chQty(u.id, 1)}>+</button>
            </div>
          </div>
        </div>
      ))}

      {totalUnidades > 0 && (
        <div className="flota-pill">
          🚌 <strong>Flota:</strong> {flotaDesc}
        </div>
      )}

      <button className="btn-primary" disabled={!canContinue} onClick={handleContinue}>
        Continuar →
      </button>
    </div>
  );
}
