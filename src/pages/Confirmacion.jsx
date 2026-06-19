import React from 'react';
import { formatARS, formatDate } from '../utils/calculos';

export default function Confirmacion({ reserva, pago, onNueva }) {
  const { origen, destino, fechaInicio, fechaFin, nights, flotaUnidades } = reserva;
  const { grandTotal, sena, saldo, payMethod } = pago;

  const numReserva = 'SRC-' + Date.now().toString().slice(-6);

  return (
    <div className="confirm-page">
      <div className="confirm-icon">✅</div>
      <div className="confirm-title">¡Reserva confirmada!</div>
      <div className="confirm-sub">
        En breve recibís la confirmación con todos los detalles por WhatsApp.
      </div>

      <div className="confirm-detail">
        <div className="confirm-row hl"><span>N° de reserva</span><span>{numReserva}</span></div>
        <div className="confirm-row"><span>Origen</span><span>{origen}</span></div>
        <div className="confirm-row"><span>Destino</span><span>{destino}</span></div>
        <div className="confirm-row"><span>Salida</span><span>{formatDate(fechaInicio)}</span></div>
        <div className="confirm-row"><span>Regreso</span><span>{formatDate(fechaFin)}</span></div>
        <div className="confirm-row"><span>Noches</span><span>{nights}</span></div>
        <div className="confirm-row"><span>Unidades</span><span>{flotaUnidades.length}</span></div>
        <div style={{ height: 10 }} />
        <div className="confirm-row hl"><span>Total del viaje</span><span style={{ color: '#6B21D6' }}>{formatARS(grandTotal)}</span></div>
        <div className="confirm-row" style={{ color: '#1D9E75', fontWeight: 500 }}><span>Seña abonada (30%)</span><span>{formatARS(sena)}</span></div>
        <div className="confirm-row"><span>Saldo pendiente</span><span>{formatARS(saldo)}</span></div>
        <div className="confirm-row"><span>Método de pago</span><span style={{ textTransform: 'capitalize' }}>{payMethod}</span></div>
      </div>

      <div style={{
        background: '#EDE9FB', border: '1px solid #C4B5F8', borderRadius: 10,
        padding: '12px 14px', fontSize: 13, color: '#4A0FA8',
        marginBottom: 20, lineHeight: 1.5,
      }}>
        📱 Te contactaremos a la brevedad por WhatsApp para coordinar el pago del saldo antes del viaje.
      </div>

      <button className="btn-primary" onClick={onNueva} style={{ marginTop: 0 }}>
        + Nueva cotización
      </button>
    </div>
  );
}
