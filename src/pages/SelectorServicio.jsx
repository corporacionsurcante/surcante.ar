import React from 'react';

export default function SelectorServicio({ onSelect }) {
  return (
    <div className="body" style={{ paddingTop: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>
          ¿Qué tipo de servicio necesitás?
        </div>
      </div>

      {/* Charter */}
      <div
        onClick={() => onSelect('charter')}
        style={{
          border: '1.5px solid var(--border)', borderRadius: 16,
          padding: 20, marginBottom: 14, cursor: 'pointer',
          background: 'var(--bg)', transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sp)'; e.currentTarget.style.background = 'var(--spl)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ fontSize: 36 }}>🚌</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Charter</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Larga y media distancia</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 20, color: 'var(--sp)' }}>→</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Viajes con destino fuera de Buenos Aires. Se cotiza por kilómetro recorrido más movimientos en destino.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {['Mar del Plata', 'Córdoba', 'Bariloche', 'Mendoza', 'Iguazú'].map(d => (
            <span key={d} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{d}</span>
          ))}
          <span style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>y más...</span>
        </div>
      </div>

      {/* Receptivo a disponibilidad */}
      <div
        onClick={() => onSelect('disponibilidad')}
        style={{
          border: '1.5px solid var(--border)', borderRadius: 16,
          padding: 20, marginBottom: 14, cursor: 'pointer',
          background: 'var(--bg)', transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sp)'; e.currentTarget.style.background = 'var(--spl)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ fontSize: 36 }}>⏱️</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Receptivo a disposición</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Por horas · dentro o fuera de CABA</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 20, color: 'var(--sp)' }}>→</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          La unidad queda a tu disposición por el tiempo que necesitás. Sin preocuparte por la distancia.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {['6 horas · USD 400', '12 horas · USD 1.200', '24 horas · USD 1.800', 'Fracciones por hora'].map(d => (
            <span key={d} style={{ background: '#FFF8E6', border: '1px solid #FFD166', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#7A5200', fontWeight: 500 }}>{d}</span>
          ))}
        </div>
      </div>

      {/* Receptivo */}
      <div
        onClick={() => onSelect('receptivo')}
        style={{
          border: '1.5px solid var(--border)', borderRadius: 16,
          padding: 20, cursor: 'pointer',
          background: 'var(--bg)', transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sp)'; e.currentTarget.style.background = 'var(--spl)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ fontSize: 36 }}>🏛️</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Receptivo</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>City Tour · Circuitos · Aeropuerto</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 20, color: 'var(--sp)' }}>→</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Servicios en Buenos Aires y alrededores. City tours, circuitos especiales y transfers de aeropuerto.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {['City Tour CABA', 'Temaikén', 'Parque de la Costa', 'La Plata', 'Transfer aeropuerto'].map(d => (
            <span key={d} style={{ background: 'var(--spl)', border: '1px solid var(--spm)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--spd)', fontWeight: 500 }}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
