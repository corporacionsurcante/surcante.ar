import React from 'react';
import { formatARS } from '../utils/calculos';
import { descargarPdfCotizacion } from '../utils/pdfCotizacion';
import { WHATSAPP } from '../data/pagos';

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

      {datos.errorGuardado && (
        <div style={{ background: '#FFF1F0', color: '#A8071A', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 12, lineHeight: 1.45 }}>
          ⚠️ No pudimos registrar la cotización automáticamente. Mandanos el número {datos.nroCotizacion} por WhatsApp y la cargamos nosotros.
        </div>
      )}

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

      <div className="section-label" style={{ marginBottom: 8 }}>¿Querés confirmar ahora?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {WHATSAPP.map(w => (
          <a key={w.numero}
            href={`https://wa.me/${w.numero}?text=${encodeURIComponent(`Hola ${w.nombre}! Mi cotización es ${datos.nroCotizacion}. Mi nombre es ${datos.clienteNombre || ''}. ¿Pueden confirmarme el servicio?`)}`}
            target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', background: '#25D366', borderRadius: 10, color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13, gap: 4, textAlign: 'center' }}>
            <span style={{ fontSize: 20 }}>📱</span>
            {w.label}
          </a>
        ))}
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
