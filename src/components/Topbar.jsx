import React from 'react';

export default function Topbar() {
  return (
    <div className="topbar">
      <img
        src="/Logo_Surcante_01.png"
        alt="Surcante"
        style={{ height: 32, objectFit: 'contain' }}
      />
      <span className="lang-badge">ES · EN</span>
    </div>
  );
}
