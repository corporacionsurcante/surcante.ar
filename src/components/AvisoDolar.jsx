import React from 'react';

// Aviso cuando no se pudo consultar el dólar oficial y se cotiza con el último valor conocido.
export default function AvisoDolar({ error, dolar }) {
  if (!error) return null;
  return (
    <div style={{
      background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 10,
      padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#F59E0B', fontWeight: 600, lineHeight: 1.45,
    }}>
      ⚠️ No pudimos consultar el dólar oficial en este momento. Los valores se calcularon con
      {dolar ? ` USD 1 = $${Math.round(dolar).toLocaleString('es-AR')}` : ' un valor de referencia'} y
      se confirman al reservar.
    </div>
  );
}
