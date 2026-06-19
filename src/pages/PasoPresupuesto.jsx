import React, { useState } from 'react';
import { useDolar } from '../hooks/useDolar';
import { calcPresupuestoTotal, calcSena, formatARS, formatDate } from '../utils/calculos';
import { PAYMENT_METHODS } from '../data/constants';

const PAY_ICONS = { mercadopago: '💳', tarjeta: '🏦', transferencia: '🏛️', efectivo: '💵' };

export default function PasoPresupuesto({ reserva, onBack, onConfirm }) {
  const { dolar, loading } = useDolar();
  const [payMethod, setPayMethod] = useState('mercadopago');

  const { flotaUnidades, syncMode, movData, movKmData, kmTotal,
          origen, destino, fechaInicio, fechaFin, nights } = reserva;

  const { grandTotal, detalles } = dolar
    ? calcPresupuestoTotal({ flotaUnidades, kmTotal, movData, movKmData, syncMode, dolar })
    : { grandTotal: 0, detalles: [] };

  const sena = calcSena(grandTotal);
  const saldo = grandTotal - sena;

  return (
    <div className="body">
      <div className="presup-hero">
        <div className="presup-hero-label">Total del viaje</div>
        <div className="presup-hero-val">{loading ? 'Calculando...' : formatARS(grandTotal)}</div>
        <div className="presup-hero-sub">{nights} noches · {flotaUnidades.length} unidad{flotaUnidades.length !== 1 ? 'es' : ''} · con IVA incluido</div>
        {!loading && (
          <div className="sena-box">
            💰 Seña (30%): <strong>{formatARS(sena)}</strong> · Saldo: <strong>{formatARS(saldo)}</strong>
          </div>
        )}
      </div>

      <div className="section-label">Resumen del viaje</div>
      <div className="pcard">
        <div className="prow"><span>📍 Origen</span><span style={{ fontWeight: 500 }}>{origen}</span></div>
        <div className="prow"><span>🏁 Destino</span><span style={{ fontWeight: 500 }}>{destino}</span></div>
        <div className="prow"><span>📅 Salida</span><span>{formatDate(fechaInicio)}</span></div>
        <div className="prow"><span>📅 Regreso</span><span>{formatDate(fechaFin)}</span></div>
        <div className="prow"><span>🛣️ Km totales</span><span>{kmTotal?.toLocaleString('es-AR')} km</span></div>
      </div>

      <div className="section-label">Detalle por unidad</div>
      <div className="pcard">
        {detalles.map((d, idx) => {
          const grupos = d.grupos || {};
          return (
            <div key={d.id}>
              {idx > 0 && <div style={{ height: 8 }} />}
              <div className={`prow hl ${idx > 0 ? 'sep' : ''}`}>
                <span>{d.type.icon} {d.label}</span>
                <span>{formatARS(d.total)}</span>
              </div>
              <div className="prow sub"><span>Recorrido {d.kmTotalConExtra?.toLocaleString('es-AR')} km</span><span>{formatARS(d.traslNeto)}</span></div>
              {d.movNeto > 0 && (
                <>
                  <div className="prow sub"><span>Movimientos en destino</span><span>{formatARS(d.movNeto)}</span></div>
                  {[1, 2, 3].map(m => grupos[m] > 0 ? (
                    <div key={m} className="prow sub" style={{ paddingLeft: 20 }}>
                      <span>{grupos[m]} día{grupos[m] > 1 ? 's' : ''} × {m} mov.</span>
                      <span>{formatARS(d.type.movUSD[m - 1] * (1 - d.type.movDesc) * dolar * grupos[m])}</span>
                    </div>
                  ) : null)}
                </>
              )}
              {d.kmExtra > 0 && (
                <div className="prow sub"><span>Km extra movimientos (+{d.kmExtra} km)</span><span>{formatARS(d.kmExtra * d.type.usdKm * dolar)}</span></div>
              )}
              <div className="prow sub"><span>IVA (21%)</span><span>{formatARS(d.ivaTotal)}</span></div>
            </div>
          );
        })}
        <div className="prow total"><span>Total general</span><span>{formatARS(grandTotal)}</span></div>
      </div>

      <div className="section-label">Método de pago de la seña</div>
      <div className="pay-grid">
        {PAYMENT_METHODS.map(p => (
          <div
            key={p.id}
            className={`pay-opt ${payMethod === p.id ? 'selected' : ''}`}
            onClick={() => setPayMethod(p.id)}
          >
            <span className="pay-opt-icon">{PAY_ICONS[p.id]}</span>
            {p.label}
          </div>
        ))}
      </div>

      <button
        className="btn-primary green"
        disabled={loading || grandTotal === 0}
        onClick={() => onConfirm({ grandTotal, sena, saldo, payMethod })}
      >
        ✓ Confirmar y pagar seña {!loading && formatARS(sena)}
      </button>
      <button className="btn-secondary" onClick={onBack}>← Modificar recorrido</button>
    </div>
  );
}
