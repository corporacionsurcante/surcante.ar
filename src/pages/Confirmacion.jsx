import React, { useEffect, useState } from 'react';
import { formatARS, formatDate } from '../utils/calculos';
import { crearReserva } from '../firebase/services';
import { generarNroCotizacion, descargarPdfCotizacion } from '../utils/pdfCotizacion';

export default function Confirmacion({ reserva, pago, onNueva }) {
  const [nroCotizacion] = React.useState(generarNroCotizacion);
  const { origen, destino, fechaInicio, fechaFin, dias, flotaUnidades, kmTotal, puntosCarga } = reserva;
  const { grandTotal, sena, saldo, payMethod, clienteNombre, clienteWhatsapp } = pago;
  const [numReserva, setNumReserva] = useState('');

  const datosPdf = {
    tipo: 'charter',
    nroCotizacion,
    baseId: reserva.baseId || '',
    baseNombre: reserva.baseNombre || '',
    origen, destino, fechaInicio, fechaFin, dias, kmTotal,
    puntosCarga: puntosCarga || [],
    clienteNombre: clienteNombre || '',
    clienteWhatsapp: clienteWhatsapp || '',
    flotaUnidades: flotaUnidades.map(u => ({ id: u.id, label: u.label, tipo: u.tid })),
    grandTotal, sena, saldo, payMethod,
  };

  useEffect(() => {
    crearReserva(datosPdf).then(ref => {
      setNumReserva('SRC-' + ref.id.slice(-6).toUpperCase());
    }).catch(() => {
      setNumReserva('SRC-' + Date.now().toString().slice(-6));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="confirm-page">
      <div className="confirm-icon">✅</div>
      <div style={{ background: '#F4F2FA', borderRadius: 10, padding: '10px 16px', marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#9090B0', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Número de cotización</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#7B2FBE', letterSpacing: '.05em' }}>{nroCotizacion}</div>
        <div style={{ fontSize: 11, color: '#9090B0', marginTop: 3 }}>Guardá este número para consultas</div>
      </div>
      <div className="confirm-title">¡Reserva confirmada!</div>
      <div className="confirm-sub">
        En breve recibís todos los detalles por WhatsApp.
      </div>

      {numReserva && (
        <div className="confirm-num">
          N° de reserva · <strong>{numReserva}</strong>
        </div>
      )}

      <div className="confirm-detail">
        <div className="confirm-row hl"><span>Total del viaje</span><span style={{ color: '#00C896' }}>{formatARS(grandTotal)}</span></div>
        <div className="confirm-row" style={{ color: '#00C896', fontWeight: 600 }}><span>Seña abonada (30%)</span><span>{formatARS(sena)}</span></div>
        <div className="confirm-row"><span>Saldo pendiente</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{formatARS(saldo)}</span></div>
        <div style={{ height: 12 }} />
        {reserva.baseNombre && (
          <div className="confirm-row"><span>Base de salida</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{reserva.baseNombre}</span></div>
        )}
        <div className="confirm-row"><span>Origen</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{origen}</span></div>
        <div className="confirm-row"><span>Destino</span><span style={{ color: 'rgba(255,255,255,.8)' }}>{destino}</span></div>
        <div className="confirm-row"><span>Salida</span><span>{formatDate(fechaInicio)}</span></div>
        <div className="confirm-row"><span>Regreso</span><span>{formatDate(fechaFin)}</span></div>
        <div className="confirm-row"><span>Días de servicio</span><span>{dias}</span></div>
        <div className="confirm-row"><span>Unidades</span><span>{flotaUnidades.length}</span></div>
        <div className="confirm-row"><span>Km totales</span><span>{kmTotal?.toLocaleString('es-AR')} km</span></div>
        {!!puntosCarga?.length && (
          <div className="confirm-row"><span>Puntos de carga</span><span>{puntosCarga.length}</span></div>
        )}
        <div className="confirm-row"><span>Pago</span><span style={{ textTransform: 'capitalize' }}>{payMethod}</span></div>
      </div>

      <div style={{
        background: 'var(--spl)', border: '1px solid var(--spm)', borderRadius: 12,
        padding: '13px 16px', fontSize: 13, color: 'var(--spd)',
        marginBottom: 24, lineHeight: 1.6, fontWeight: 500,
      }}>
        📱 Te contactamos a la brevedad por WhatsApp para coordinar el pago del saldo antes del viaje.
      </div>

      <button
        className="btn-primary"
        style={{ marginTop: 0, background: '#7B2FBE' }}
        onClick={() => descargarPdfCotizacion(datosPdf)}>
        📄 Descargar presupuesto en PDF
      </button>

      <button className="btn-primary" onClick={onNueva} style={{ marginTop: 10 }}>
        + Nueva cotización
      </button>
    </div>
  );
}
