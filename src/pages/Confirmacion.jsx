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
        En breve recibís todos los detalles por WhatsApp.
      </div>

      <div className="confirm-num">
        N° de reserva · <strong>{numReserva}</strong>
      </div>

      <div className="confirm-detail">
        <div className="confirm-row hl"><span>Total del viaje</span><span style={{ color: '#00C896' }}>{formatARS(grandTotal)}</span></div>
        <div className="confirm-row" style={{ color: '#00C896', fontWeight: 600 }}><span>Seña abonada (30%)</span><span>{formatARS(sena)}</span></div>
        <div className="confirm-row"><span>Saldo pendiente</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{formatARS(saldo)}</span></div>
        <div style={{ height: 12 }} />
        <div className="confirm-row"><span>Origen</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{origen}</span></div>
        <div className="confirm-row"><span>Destino</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{destino}</span></div>
        <div className="confirm-row"><span>Salida</span><span>{formatDate(fechaInicio)}</span></div>
        <div className="confirm-row"><span>Regreso</span><span>{formatDate(fechaFin)}</span></div>
        <div className="confirm-row"><span>Noches</span><span>{nights}</span></div>
        <div className="confirm-row"><span>Unidades</span><span>{flotaUnidades.length}</span></div>
        <div className="confirm-row"><span>Pago</span><span style={{ textTransform: 'capitalize' }}>{payMethod}</span></div>
      </div>

      <div style={{
        background: 'var(--spl)', border: '1px solid var(--spm)', borderRadius: 12,
        padding: '13px 16px', fontSize: 13, color: 'var(--spd)',
        marginBottom: 24, lineHeight: 1.6, fontWeight: 500,
      }}>
        📱 Te contactamos a la brevedad por WhatsApp para coordinar el pago del saldo antes del viaje.
      </div>

      <button className="btn-primary" onClick={onNueva} style={{ marginTop: 0 }}>
        + Nueva cotización
      </button>
    </div>
  );
}
