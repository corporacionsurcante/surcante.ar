import React, { useRef, useEffect } from 'react';

export default function ConversorUSD({ usdValue, dolar, onChangeUSD }) {
  const arsRef = useRef(null);
  const editandoARS = useRef(false);

  useEffect(() => {
    if (!editandoARS.current && arsRef.current) {
      arsRef.current.value = dolar && usdValue ? Math.round(usdValue * dolar) : '';
    }
  }, [usdValue, dolar]);

  if (!dolar) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '8px 10px', background: 'var(--ad-card-2)', border: '1px solid var(--ad-sep)', borderRadius: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ad-text-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>USD</div>
        <input
          type="number" step="0.01" min="0"
          value={usdValue || ''}
          onChange={e => {
            const n = parseFloat(e.target.value) || 0;
            if (arsRef.current && !editandoARS.current) {
              arsRef.current.value = dolar ? String(Math.round(n * dolar)) : '';
            }
            if (onChangeUSD) onChangeUSD(n);
          }}
          style={{ border: '1.5px solid var(--ad-accent)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', fontWeight: 600, color: 'var(--ad-accent)', background: 'var(--ad-card)', width: '100%' }}
        />
      </div>
      <div style={{ color: 'var(--ad-text-3)', fontSize: 14, fontWeight: 700, paddingTop: 16 }}>⇄</div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ad-text-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>$ ARS</div>
        <input
          ref={arsRef}
          type="number" step="1" min="0"
          defaultValue={dolar && usdValue ? Math.round(usdValue * dolar) : ''}
          placeholder="ej: 3200"
          onFocus={() => { editandoARS.current = true; }}
          onBlur={() => { editandoARS.current = false; }}
          onInput={e => {
            const n = parseFloat(e.target.value) || 0;
            if (dolar && onChangeUSD) onChangeUSD(parseFloat((n / dolar).toFixed(2)));
          }}
          style={{ border: '1.5px solid var(--ad-teal)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', fontWeight: 600, color: 'var(--ad-teal)', background: 'var(--ad-card)', width: '100%' }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--ad-text-3)', paddingTop: 16, whiteSpace: 'nowrap' }}>
        1 USD = ${Math.round(dolar).toLocaleString('es-AR')}
      </div>
    </div>
  );
}
