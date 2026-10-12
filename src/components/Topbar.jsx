import React from 'react';

export default function Topbar({ onHome }) {
  return (
    <div className="topbar" style={{ padding: '0 20px', height: 64, gap: 12 }}>
      {/* Logo con botón home */}
      <div
        onClick={onHome}
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: onHome ? 'pointer' : 'default', flex: 1 }}>
        <img
          src="/Logo_Surcante_01.png"
          alt="Surcante"
          style={{ height: 42, objectFit: 'contain' }}
        />
        {onHome && (
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'var(--sp)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              Cotizador
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 500, letterSpacing: '.05em' }}>
              Tocá para volver al inicio
            </div>
          </div>
        )}
      </div>

      {/* Acciones derecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onHome && (
          <button
            onClick={onHome}
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '7px 14px', color: 'var(--sp)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all .15s',
            }}
          >
            ⌂ Inicio
          </button>
        )}
        <span className="lang-badge">ES · EN</span>
      </div>
    </div>
  );
}
