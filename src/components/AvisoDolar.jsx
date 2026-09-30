import React from 'react';

// Aviso cuando no se pudo consultar el dólar oficial y se cotiza con el último valor conocido.
export default function AvisoDolar({ error, dolar }) {
  if (!error) return null;
  return (
    <div style={{
      background: '#FFF8E6', border: '1px solid #FFD166', borderRadius: 10,
      padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#7A5200', fontWeight: 600, lineHeight: 1.45,
    }}>
      ⚠️ No pudimos consultar el dólar oficial en este momento. Los valores se calcularon con
      {dolar ? ` USD 1 = $${Math.round(dolar).toLocaleString('es-AR')}` : ' un valor de referencia'} y
      se confirman al reservar.
    </div>
  );
}
