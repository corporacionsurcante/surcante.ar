import React, { useState } from 'react';
import { useDolar } from '../hooks/useDolar';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { getDiasServicio, formatARS, formatDate } from '../utils/calculos';
import { CITY_TOUR_USD, CIRCUITOS, TRANSFERS_AEROPUERTO } from '../data/receptivo';
import Calendario from '../components/Calendario';

const PASOS = ['Unidad', 'Programa', 'Presupuesto'];
const TIPO_UNIT = {
  'MIX 60':     { icon: '🚌', label: 'Omnibus doble piso / 60 but.' },
  'Comun 45':   { icon: '🚌', label: 'Omnibus 45 butacas' },
  'Minibus 24': { icon: '🚐', label: 'Minibus 24 butacas' },
  'Minibus 19': { icon: '🚐', label: 'Minibus 19 butacas' },
};

export default function ReceptivoCotizador({ onBack }) {
  const { dolar, loading: loadingDolar } = useDolar();
  const [step, setStep] = useState(1);
  const [fechas, setFechas] = useState({ fechaInicio: '', fechaFin: '', mismodia: false, dias: 1 });
  const [unidadSel, setUnidadSel] = useState(null);
  const [programa, setPrograma] = useState([]); // array de { tipo: 'city'|'circuito'|'transfer', dia: N, id?, nombre }
  const [diaEditando, setDiaEditando] = useState(1);
  const [payMethod, setPayMethod] = useState('transferencia');

  const { disponibilidad, loading: loadingDisp } = useDisponibilidad(fechas.fechaInicio, fechas.fechaFin);
  const dias = fechas.dias || 1;

  // Calcular precio de un día según el programa
  function getPrecioDia(diaNum) {
    const item = programa.find(p => p.dia === diaNum);
    if (!item || !unidadSel || !dolar) return 0;
    const tipo = unidadSel.tipo;
    if (item.tipo === 'city') return (CITY_TOUR_USD[tipo] || 0) * dolar;
    if (item.tipo === 'circuito') {
      const circ = CIRCUITOS.find(c => c.id === item.id);
      return circ ? (circ.precioUSD[tipo] || 0) * dolar : 0;
    }
    if (item.tipo === 'transfer') {
      const tr = TRANSFERS_AEROPUERTO.find(t => t.id === item.id);
      return tr ? tr.precioUSD * dolar : 0;
    }
    return 0;
  }

  function getNombreDia(diaNum) {
    const item = programa.find(p => p.dia === diaNum);
    if (!item) return null;
    if (item.tipo === 'city') return '🏛️ City Tour CABA';
    if (item.tipo === 'circuito') {
      const circ = CIRCUITOS.find(c => c.id === item.id);
      return circ ? `${circ.emoji} ${circ.nombre}` : item.nombre;
    }
    if (item.tipo === 'transfer') {
      const tr = TRANSFERS_AEROPUERTO.find(t => t.id === item.id);
      return tr ? `${tr.emoji} ${tr.nombre}` : item.nombre;
    }
    return null;
  }

  const subtotal = Array.from({ length: dias }, (_, i) => getPrecioDia(i + 1)).reduce((a, b) => a + b, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  const sena = total * 0.30;
  const diasConPrograma = programa.length;

  function asignarDia(tipo, id, nombre) {
    setPrograma(prev => {
      const sin = prev.filter(p => p.dia !== diaEditando);
      return [...sin, { dia: diaEditando, tipo, id, nombre }];
    });
  }

  function limpiarDia(diaNum) {
    setPrograma(prev => prev.filter(p => p.dia !== diaNum));
  }

  // PASO 3 — Presupuesto
  if (step === 3) {
    return (
      <div className="body">
        <div className="presup-hero">
          <div className="presup-hero-label">Total del servicio</div>
          <div className="presup-hero-val">{loadingDolar ? 'Calculando...' : formatARS(total)}</div>
          <div className="presup-hero-sub">
            {dias} día{dias > 1 ? 's' : ''} de servicio · {unidadSel?.tipo} · IVA incluido
          </div>
          {!loadingDolar && (
            <div className="sena-box">
              <div className="sena-item">
                <div className="sena-label">Seña (30%)</div>
                <div className="sena-val green">{formatARS(sena)}</div>
              </div>
              <div className="sena-divider" />
              <div className="sena-item">
                <div className="sena-label">Saldo</div>
                <div className="sena-val">{formatARS(total - sena)}</div>
              </div>
              <div className="sena-divider" />
              <div className="sena-item">
                <div className="sena-label">Días</div>
                <div className="sena-val">{dias}</div>
              </div>
            </div>
          )}
        </div>

        <div className="section-label">Programa del servicio</div>
        <div className="pcard">
          <div className="prow hl"><span>Unidad</span><span>{unidadSel?.tipo} · Int. {unidadSel?.interno}</span></div>
          <div className="prow"><span>Fechas</span><span>{formatDate(fechas.fechaInicio)} → {formatDate(fechas.fechaFin)}</span></div>
          <div style={{ height: 8 }} />
          {Array.from({ length: dias }, (_, i) => {
            const diaNum = i + 1;
            const nombre = getNombreDia(diaNum);
            const precio = getPrecioDia(diaNum);
            return (
              <div key={diaNum} className="prow">
                <span style={{ color: nombre ? 'var(--text)' : 'var(--text-3)' }}>
                  Día {diaNum}{nombre ? ` · ${nombre}` : ' · Sin asignar'}
                </span>
                <span style={{ fontWeight: 600 }}>{precio > 0 ? formatARS(precio) : '—'}</span>
              </div>
            );
          })}
          <div className="prow"><span>IVA (21%)</span><span>{formatARS(iva)}</span></div>
          <div className="prow total"><span>Total</span><span>{formatARS(total)}</span></div>
        </div>

        <div className="section-label">Método de pago</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'mercadopago', label: 'MercadoPago', icon: '💳', desc: '10% ahora online' },
            { id: 'transferencia', label: 'Transferencia', icon: '🏛️', desc: '30% para confirmar' },
            { id: 'efectivo', label: 'Efectivo', icon: '💵', desc: 'Coordinás por WhatsApp' },
          ].map(m => (
            <div key={m.id} onClick={() => setPayMethod(m.id)}
              style={{
                border: `1.5px solid ${payMethod === m.id ? 'var(--sp)' : 'var(--border)'}`,
                borderRadius: 12, padding: '12px 14px',
                background: payMethod === m.id ? 'var(--spl)' : 'var(--bg)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              }}>
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: payMethod === m.id ? 'var(--spd)' : 'var(--text)' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.desc}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: payMethod === m.id ? 'var(--sp)' : 'var(--text-2)' }}>
                {formatARS(Math.round(total * (m.id === 'mercadopago' ? 0.10 : 0.30)))}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-primary green" disabled={total === 0 || diasConPrograma === 0}>
          ✓ Confirmar y reservar
        </button>
        <button className="btn-secondary" onClick={() => setStep(2)}>← Modificar programa</button>
      </div>
    );
  }

  // PASO 2 — Programa día por día
  if (step === 2) {
    const itemDiaActual = programa.find(p => p.dia === diaEditando);
    return (
      <div className="body">
        <div className="section-label">Programa del servicio · {dias} día{dias > 1 ? 's' : ''}</div>

        {/* Chips de días */}
        <div className="grid-dias" style={{ marginBottom: 14 }}>
          {Array.from({ length: dias }, (_, i) => {
            const diaNum = i + 1;
            const nombre = getNombreDia(diaNum);
            return (
              <div key={diaNum}
                className={`dia-chip ${nombre ? 'activo' : ''} ${diaEditando === diaNum ? 'editando' : ''}`}
                onClick={() => setDiaEditando(diaNum)}>
                <div className="dia-chip-num">D{diaNum}</div>
                <div className="dia-chip-mov" style={{ fontSize: 11 }}>{nombre ? '✓' : '—'}</div>
                <div className="dia-chip-lbl" style={{ fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nombre ? nombre.split(' ').slice(1).join(' ').slice(0, 6) : 'elegir'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Editor del día seleccionado */}
        <div style={{ background: 'var(--spl)', border: '1px solid var(--spm)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--spd)', marginBottom: 12 }}>
            Día {diaEditando} — ¿qué hace el grupo?
          </div>

          {/* City Tour */}
          <div onClick={() => asignarDia('city', 'city', 'City Tour CABA')}
            style={{
              border: `1.5px solid ${itemDiaActual?.tipo === 'city' ? 'var(--sp)' : 'var(--spm)'}`,
              borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
              background: itemDiaActual?.tipo === 'city' ? 'var(--sp)' : '#fff',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <span style={{ fontSize: 20 }}>🏛️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: itemDiaActual?.tipo === 'city' ? '#fff' : 'var(--spd)' }}>City Tour CABA</div>
              <div style={{ fontSize: 11, color: itemDiaActual?.tipo === 'city' ? 'rgba(255,255,255,.7)' : 'var(--sp)' }}>
                {formatARS((CITY_TOUR_USD[unidadSel?.tipo] || 0) * (dolar || 0))} · con IVA
              </div>
            </div>
            {itemDiaActual?.tipo === 'city' && <span style={{ color: '#fff', fontWeight: 700 }}>✓</span>}
          </div>

          {/* Circuitos */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6, marginTop: 4 }}>Circuitos especiales</div>
          {CIRCUITOS.map(c => (
            <div key={c.id} onClick={() => asignarDia('circuito', c.id, c.nombre)}
              style={{
                border: `1.5px solid ${itemDiaActual?.id === c.id ? 'var(--sp)' : 'var(--spm)'}`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                background: itemDiaActual?.id === c.id ? 'var(--sp)' : '#fff',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
              <span style={{ fontSize: 18 }}>{c.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: itemDiaActual?.id === c.id ? '#fff' : 'var(--spd)' }}>{c.nombre}</div>
                <div style={{ fontSize: 11, color: itemDiaActual?.id === c.id ? 'rgba(255,255,255,.7)' : 'var(--text-3)' }}>{c.descripcion}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: itemDiaActual?.id === c.id ? '#fff' : 'var(--sp)' }}>
                  {formatARS((c.precioUSD[unidadSel?.tipo] || 0) * (dolar || 0))}
                </div>
                {itemDiaActual?.id === c.id && <div style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</div>}
              </div>
            </div>
          ))}

          {/* Transfers */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6, marginTop: 8 }}>Transfer aeropuerto</div>
          {TRANSFERS_AEROPUERTO.map(t => (
            <div key={t.id} onClick={() => asignarDia('transfer', t.id, t.nombre)}
              style={{
                border: `1.5px solid ${itemDiaActual?.id === t.id ? 'var(--sp)' : 'var(--spm)'}`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                background: itemDiaActual?.id === t.id ? 'var(--sp)' : '#fff',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
              <span style={{ fontSize: 18 }}>{t.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: itemDiaActual?.id === t.id ? '#fff' : 'var(--spd)' }}>{t.nombre}</div>
                <div style={{ fontSize: 11, color: itemDiaActual?.id === t.id ? 'rgba(255,255,255,.7)' : 'var(--text-3)' }}>{t.descripcion}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: itemDiaActual?.id === t.id ? '#fff' : 'var(--sp)' }}>
                  {formatARS(t.precioUSD * (dolar || 0))}
                </div>
                {itemDiaActual?.id === t.id && <div style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</div>}
              </div>
            </div>
          ))}

          {itemDiaActual && (
            <button onClick={() => limpiarDia(diaEditando)}
              style={{ width: '100%', padding: 8, background: 'transparent', border: '1px solid var(--spm)', borderRadius: 8, color: 'var(--sp)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 6, fontFamily: 'Inter, sans-serif' }}>
              ✕ Limpiar día {diaEditando}
            </button>
          )}
        </div>

        {/* Resumen */}
        {diasConPrograma > 0 && (
          <div className="resumen-pill">
            <strong>{diasConPrograma} de {dias} días asignados</strong> · Total parcial: {formatARS(subtotal + iva)}
          </div>
        )}

        <button className="btn-primary" disabled={diasConPrograma === 0} onClick={() => setStep(3)}>
          Ver presupuesto →
        </button>
        <button className="btn-secondary" onClick={() => setStep(1)}>← Modificar unidad</button>
      </div>
    );
  }

  // PASO 1 — Selección de unidad y fechas
  return (
    <div className="body">
      <div className="section-label">Fechas del servicio</div>
      <Calendario onChange={f => setFechas({ ...f, dias: f.mismodia ? 1 : getDiasServicio(f.fechaInicio, f.fechaFin) })} />

      <div className="divider" />
      <div className="section-label">Seleccioná la unidad</div>

      {loadingDisp && fechas.fechaInicio && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-3)', fontSize: 13 }}>⏳ Verificando disponibilidad...</div>
      )}

      {disponibilidad.map(u => {
        const disponible = !fechas.fechaInicio || u.disponible;
        const seleccionada = unidadSel?.id === u.id;
        const tipoInfo = TIPO_UNIT[u.tipo] || { icon: '🚌', label: u.tipo };
        const precioDia = dolar ? (CITY_TOUR_USD[u.tipo] || 0) * dolar : null;

        return (
          <div key={u.id}
            className={`unit-card ${seleccionada ? 'selected' : ''} ${!disponible ? 'unavailable' : ''}`}
            onClick={() => disponible && setUnidadSel(u)}>
            <div className="unit-card-header">
              <div className="unit-ico">{tipoInfo.icon}</div>
              <div className="unit-info">
                <div className="unit-name">Int. {u.interno} · {u.patente}</div>
                <div className="unit-detail">{u.butacas} butacas · {tipoInfo.label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {precioDia && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: seleccionada ? 'var(--spd)' : 'var(--sp)' }}>
                    {formatARS(precioDia)}<span style={{ fontSize: 10, fontWeight: 500 }}>/día</span>
                  </div>
                )}
                <span className={`badge ${!fechas.fechaInicio ? 'badge-avail' : disponible ? 'badge-avail' : 'badge-unavail'}`}>
                  {!fechas.fechaInicio ? 'Disponible' : disponible ? 'Disponible' : 'Ocupado'}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <button className="btn-primary"
        disabled={!unidadSel || !fechas.fechaInicio || !fechas.fechaFin}
        onClick={() => setStep(2)}>
        Armar programa →
      </button>
      <button className="btn-secondary" onClick={onBack}>← Cambiar tipo de servicio</button>
    </div>
  );
}
