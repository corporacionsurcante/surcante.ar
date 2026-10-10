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
    id: 'movimientos',
    label: 'Movimientos CABA / GBA',
    icon: '🚐',
    desc: 'Traslados puntuales en Capital Federal o Gran Buenos Aires. Precio fijo por día.',
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
  const [modulos, setModulos] = useState({ charter: true, movimientos: true, disponibilidad: true, receptivo: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'modulos'), snap => {
      if (snap.exists()) setModulos(prev => ({ ...prev, ...snap.data() }));
      setLoading(false);
    }, e => { console.error('[Firestore] config/modulos:', e); setError('No se pudo leer la configuración.'); setLoading(false); });
    return unsub;
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await setDoc(doc(db, 'config', 'modulos'), modulos);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar. Revisá la conexión y los permisos.');
    }
    setSaving(false);
  }

  // Un módulo sin valor guardado cuenta como activo (el cotizador usa `!== false`)
  function toggle(id) {
    setModulos(prev => ({ ...prev, [id]: prev[id] === false }));
  }

  if (loading) return <div className="admin-loading">Cargando configuración...</div>;

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Módulos activos</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ad-text-2)', marginBottom: 20, fontWeight: 500 }}>
        Los módulos desactivados no aparecen en el cotizador para los clientes.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {MODULOS.map(m => {
          const activo = modulos[m.id] !== false;
          return (
            <div key={m.id} style={{
              background: 'var(--ad-card)', border: `1.5px solid ${activo ? '#8B5CF6' : 'rgba(139,92,246,0.15)'}`,
              borderRadius: 14, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 28 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: activo ? 'var(--ad-text)' : 'var(--ad-text-2)' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ad-text-3)', marginTop: 3 }}>{m.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: activo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: activo ? '#10B981' : '#EF4444',
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

      {error && <div style={{ color: '#EF4444', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button
        className={`precios-save ${saved ? 'saved' : ''}`}
        onClick={handleSave}
        disabled={saving}>
        {saved ? '✓ Configuración guardada' : 'Guardar cambios'}
      </button>
    </div>
  );
}
