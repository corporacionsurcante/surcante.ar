import React from 'react';
import { formatARS } from '../utils/calculos';
import { descargarPdfCotizacion } from '../utils/pdfCotizacion';

// Pantalla de éxito compartida por Receptivo, Disponibilidad y Movimientos.
// Muestra el N° de cotización y permite descargar el presupuesto en PDF.
export default function ReservaConfirmada({ datos, onNueva }) {
  return (
    <div className="body">
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
          ¡Cotización recibida!
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
          Te contactamos a la brevedad por WhatsApp para confirmar.
        </div>
      </div>

      <div style={{ background: '#F4F2FA', borderRadius: 10, padding: '10px 16px', margin: '14px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#9090B0', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Número de cotización</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#7B2FBE', letterSpacing: '.05em' }}>{datos.nroCotizacion}</div>
        <div style={{ fontSize: 11, color: '#9090B0', marginTop: 3 }}>Guardá este número para consultas</div>
      </div>

      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
          <span style={{ color: 'var(--text-3)' }}>Total del viaje</span>
          <span style={{ fontWeight: 800, color: '#00966E' }}>{formatARS(datos.grandTotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
          <span style={{ color: 'var(--text-3)' }}>Pago inicial</span>
          <span style={{ fontWeight: 600 }}>{formatARS(datos.sena)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
          <span style={{ color: 'var(--text-3)' }}>Saldo</span>
          <span style={{ fontWeight: 600 }}>{formatARS(datos.saldo)}</span>
        </div>
      </div>

      <button
        className="btn-primary"
        style={{ background: '#7B2FBE', marginTop: 0 }}
        onClick={() => descargarPdfCotizacion(datos)}>
        📄 Descargar presupuesto en PDF
      </button>

      <button className="btn-secondary" onClick={onNueva}>+ Nueva cotización</button>
    </div>
  );
}
