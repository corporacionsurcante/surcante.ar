import React, { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const MODULOS = [
  {
    id: 'charter',
    label: 'Charter',
    icon: '🚌',
    desc: 'Viajes de larga y media distancia. Cotiza por km recorrido más movimientos en destino.',
  },
  {
    id: 'disponibilidad',
    label: 'Receptivo a disposición',
    icon: '⏱️',
    desc: 'Servicio por horas dentro o fuera de CABA. Paquetes de 6, 12 y 24 horas.',
  },
  {
    id: 'receptivo',
    label: 'Receptivo',
    icon: '🏛️',
    desc: 'City Tour, circuitos especiales y transfers de aeropuerto.',
  },
];

export default function ConfigModulos() {
  const [modulos, setModulos] = useState({ charter: true, disponibilidad: true, receptivo: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'modulos'), snap => {
      if (snap.exists()) setModulos(snap.data());
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleSave() {
    setSaving(true);
    await setDoc(doc(db, 'config', 'modulos'), modulos);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  function toggle(id) {
    setModulos(prev => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) return <div className="admin-loading">Cargando configuración...</div>;

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Módulos activos</div>
      </div>
      <div style={{ fontSize: 13, color: '#9090B0', marginBottom: 20, fontWeight: 500 }}>
        Los módulos desactivados no aparecen en el cotizador para los clientes.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {MODULOS.map(m => {
          const activo = modulos[m.id] !== false;
          return (
            <div key={m.id} style={{
              background: '#fff', border: `1.5px solid ${activo ? '#7B2FBE' : '#EDE8F8'}`,
              borderRadius: 14, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 28 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: activo ? '#0A0A0F' : '#9090B0' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: '#9090B0', marginTop: 3 }}>{m.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: activo ? '#E6FBF5' : '#FFF1F0',
                  color: activo ? '#007A5A' : '#CF1322',
                }}>
                  {activo ? '✅ Activo' : '❌ Inactivo'}
                </span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={activo} onChange={() => toggle(m.id)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <button
        className={`precios-save ${saved ? 'saved' : ''}`}
        onClick={handleSave}
        disabled={saving}>
        {saved ? '✓ Configuración guardada' : 'Guardar cambios'}
      </button>
    </div>
  );
}
