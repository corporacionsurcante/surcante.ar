import React, { useState, useEffect } from 'react';
import { useDolar } from '../hooks/useDolar';
import { formatARS } from '../utils/calculos';
import { guardarReserva } from '../firebase/reservasService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { DATOS_BANCARIOS, WHATSAPP } from '../data/pagos';

const TIPO_UNIT = {
  'MIX 60':     { icon: '🚌', label: 'Omnibus Mix 60' },
  'Comun 45':   { icon: '🚌', label: 'Omnibus Común 45' },
  'Minibus 24': { icon: '🚐', label: 'Minibus 24 butacas' },
  'Minibus 19': { icon: '🚐', label: 'Minibus 19 butacas' },
};

const PAQUETES_RAPIDOS = [
  { horas: 3,  label: '3 hs' },
  { horas: 6,  label: '6 hs' },
  { horas: 8,  label: '8 hs' },
  { horas: 12, label: '12 hs' },
  { horas: 15, label: '15 hs' },
  { horas: 24, label: '24 hs' },
];

// Precios por defecto (se sobreescriben desde Firebase)
const PRECIOS_DEFAULT = { hora: 150, p6h: 400, p12h: 1200, p24h: 1800 };

function calcPrecioLocal(horas, precios) {
  const { hora, p6h, p12h, p24h } = precios;
  if (horas < 3) return { precioUSD: 0, descripcion: 'Mínimo 3 horas' };
  // 3hs → se cobra por hora (3 × precio/hora)
  if (horas === 3) return { precioUSD: 3 * hora, descripcion: `3 horas × USD ${hora}` };
  // 4-6hs → paquete 6hs
  if (horas <= 6) return { precioUSD: p6h, descripcion: 'Paquete 6 horas' };
  // 7-12hs → paquete 12hs
  if (horas <= 12) return { precioUSD: p12h, descripcion: 'Paquete 12 horas' };
  // 13-15hs → paquete 12hs + horas extra
  if (horas <= 15) { const extra = horas - 12; return { precioUSD: p12h + extra * hora, descripcion: `Paquete 12hs + ${extra}h extra × USD ${hora}` }; }
  // 16-24hs → paquete 24hs
  return { precioUSD: p24h, descripcion: 'Paquete 24 horas' };
}

export default function DisponibilidadCotizador({ onBack }) {
  const { dolar, loading: loadingDolar } = useDolar();
  const [precios, setPrecios] = useState(PRECIOS_DEFAULT);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'disponibilidad_precios'), snap => {
      if (snap.exists()) setPrecios({ ...PRECIOS_DEFAULT, ...snap.data() });
    });
    return unsub;
  }, []);
  const [fecha, setFecha] = useState('');
  const [horas, setHoras] = useState(3);
  const [unidadSel, setUnidadSel] = useState(null);
  const [payMethod, setPayMethod] = useState('transferencia');
  const [step, setStep] = useState(1);
  const [contacto, setContacto] = useState({ nombre: '', whatsapp: '' });
  const contactoValido = contacto.nombre.trim().length > 1 && contacto.whatsapp.trim().length >= 8;

  const { disponibilidad, loading: loadingDisp } = useDisponibilidad(fecha, fecha);

  const { precioUSD, descripcion } = calcPrecioLocal(horas, precios);
  const subtotal = precioUSD * (dolar || 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  const montoAhora = Math.round(total * (payMethod === 'mercadopago' || payMethod === 'tarjeta' ? 0.10 : 0.30));
  const saldo = total - montoAhora;

  function buildWAMsg(nombre) {
    return encodeURIComponent(
      `Hola ${nombre}! Quiero reservar un servicio a disposición con Surcante.\n\n` +
      `📅 Fecha: ${fecha}\n` +
      `⏱️ Duración: ${horas} horas (${descripcion})\n` +
      `🚌 Unidad: ${unidadSel?.tipo} · Int. ${unidadSel?.interno}\n` +
      `💰 Total: ${formatARS(total)}\n` +
      `💳 Método: ${payMethod}\n` +
      `✅ Pago ahora: ${formatARS(montoAhora)}`
    );
  }

  // PASO 2 — Presupuesto
  if (step === 2) {
    return (
      <div className="body">
        <div className="presup-hero">
          <div className="presup-hero-label">Total del servicio</div>
          <div className="presup-hero-val">{loadingDolar ? 'Calculando...' : formatARS(total)}</div>
          <div className="presup-hero-sub">
            {horas}h disposición · {unidadSel?.tipo} · Impuestos incluidos
          </div>
          {!loadingDolar && (
            <div className="sena-box">
              <div className="sena-item">
                <div className="sena-label">Pagás ahora</div>
                <div className="sena-val green">{formatARS(montoAhora)}</div>
              </div>
              <div className="sena-divider" />
              <div className="sena-item">
                <div className="sena-label">Saldo</div>
                <div className="sena-val">{formatARS(saldo)}</div>
              </div>
              <div className="sena-divider" />
              <div className="sena-item">
                <div className="sena-label">Horas</div>
                <div className="sena-val">{horas}h</div>
              </div>
            </div>
          )}
        </div>

        <div className="section-label">Detalle del servicio</div>
        <div className="pcard">
          <div className="prow hl"><span>⏱️ {descripcion}</span><span>{formatARS(subtotal)}</span></div>
          <div className="prow"><span>Unidad</span><span>{unidadSel?.tipo} · Int. {unidadSel?.interno} · {unidadSel?.patente}</span></div>
          <div className="prow"><span>Fecha</span><span>{fecha}</span></div>
          <div className="prow sub"><span>Con impuestos</span><span>{formatARS(iva)}</span></div>
          <div className="prow total"><span>Total</span><span>{formatARS(total)}</span></div>
        </div>

        <div className="section-label">Método de pago</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {[
            { id: 'transferencia', label: 'Transferencia', icon: '🏛️', desc: '30% para confirmar', porc: 0.30 },
            { id: 'efectivo', label: 'Efectivo', icon: '💵', desc: 'Coordinás por WhatsApp', porc: 0.30 },
            { id: 'mercadopago', label: 'MercadoPago', icon: '💳', desc: '10% ahora online', porc: 0.10 },
            { id: 'tarjeta', label: 'Tarjeta', icon: '🏦', desc: '10% ahora online', porc: 0.10 },
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
                {formatARS(Math.round(total * m.porc))}
              </div>
            </div>
          ))}
        </div>

        {payMethod === 'transferencia' && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Datos bancarios</div>
            {[
              ['Titular', DATOS_BANCARIOS.titular],
              ['Banco', `${DATOS_BANCARIOS.banco} · ${DATOS_BANCARIOS.sucursal}`],
              ['CBU', DATOS_BANCARIOS.cbu],
              ['CUIT', DATOS_BANCARIOS.cuit],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Enviar comprobante</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {WHATSAPP.map(w => (
                  <a key={w.numero} href={`https://wa.me/${w.numero}?text=${buildWAMsg(w.nombre)}${encodeURIComponent('\n\n📎 Te envío el comprobante.')}`}
                    target="_blank" rel="noreferrer"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', background: '#25D366', borderRadius: 10, color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13, gap: 4 }}>
                    <span style={{ fontSize: 20 }}>📱</span>{w.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {payMethod === 'efectivo' && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Contactar por WhatsApp</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {WHATSAPP.map(w => (
                <a key={w.numero} href={`https://wa.me/${w.numero}?text=${buildWAMsg(w.nombre)}${encodeURIComponent('\n\nQuiero coordinar el pago en efectivo.')}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', background: '#25D366', borderRadius: 10, color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13, gap: 4 }}>
                  <span style={{ fontSize: 20 }}>📱</span>{w.label}
                </a>
              ))}
            </div>
          </div>
        )}


        <div className="section-label">Tus datos de contacto</div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>Nombre completo</div>
            <input type="text" placeholder="ej: Juan García"
              value={contacto.nombre}
              onChange={e => setContacto(c => ({ ...c, nombre: e.target.value }))}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>WhatsApp</div>
            <input type="tel" placeholder="ej: 11 1234 5678"
              value={contacto.whatsapp}
              onChange={e => setContacto(c => ({ ...c, whatsapp: e.target.value }))}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
          </div>
        </div>
        {(payMethod === 'transferencia' || payMethod === 'efectivo') && (
          <button className="btn-primary green"
            disabled={!contactoValido}
            onClick={async () => {
              try {
                await guardarReserva({
                  tipo: 'disposicion',
                  clienteNombre: contacto.nombre,
                  clienteWhatsapp: contacto.whatsapp,
                  unidad: `${unidadSel?.tipo} · Int. ${unidadSel?.interno}`,
                  fechaInicio: fecha,
                  fechaFin: fecha,
                  horas,
                  descripcion: descripcion || '',
                  grandTotal: total,
                  sena: montoAhora,
                  saldo,
                  payMethod,
                });
              } catch(e) { console.error('Error guardando reserva:', e); }
              alert('¡Reserva recibida! Te contactamos a la brevedad para confirmar.');
            }}>
            ✓ Confirmar reserva
          </button>
        )}

        {(payMethod === 'mercadopago' || payMethod === 'tarjeta') && (
          <button className="btn-primary"
            style={{ background: payMethod === 'mercadopago' ? '#009EE3' : '#6B21D6' }}
            onClick={() => alert('Integración online en proceso. Por favor usá transferencia o efectivo.')}>
            {payMethod === 'mercadopago' ? '💳' : '🏦'} Pagar {formatARS(montoAhora)}
          </button>
        )}

        <button className="btn-secondary" onClick={() => setStep(1)}>← Modificar servicio</button>
      </div>
    );
  }

  // PASO 1 — Selector
  return (
    <div className="body">
      <div className="section-label">Fecha del servicio</div>
      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
        min={(() => { const now = new Date(); if (now.getHours() >= 18) { const m = new Date(now); m.setDate(m.getDate()+1); return m.toISOString().split('T')[0]; } return now.toISOString().split('T')[0]; })()}
        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: 16 }} />

      <div className="section-label">Horas de servicio</div>

      {/* Selector rápido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {PAQUETES_RAPIDOS.map(p => {
          
          return (
            <div key={p.horas} onClick={() => setHoras(p.horas)}
              style={{
                border: `1.5px solid ${horas === p.horas ? 'var(--sp)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
                background: horas === p.horas ? 'var(--spl)' : 'var(--bg)',
              }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: horas === p.horas ? 'var(--spd)' : 'var(--text)' }}>{p.label}</div>
              <div style={{ fontSize: 11, color: horas === p.horas ? 'var(--sp)' : 'var(--text-3)', fontWeight: 600 }}>USD {calcPrecioLocal(p.horas, precios).precioUSD}</div>
            </div>
          );
        })}
      </div>

      {/* Slider fino */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
          <span>3 horas</span>
          <span style={{ fontWeight: 700, color: 'var(--sp)', fontSize: 14 }}>{horas} hora{horas !== 1 ? 's' : ''}</span>
          <span>24 horas</span>
        </div>
        <input type="range" min={3} max={24} value={horas} onChange={e => setHoras(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--sp)' }} />
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--spl)', borderRadius: 8, fontSize: 12, color: 'var(--spd)', fontWeight: 600, textAlign: 'center' }}>
          {descripcion} · {formatARS(dolar ? subtotal : 0)} {dolar ? '(sin impuestos)' : ''}
        </div>
      </div>

      <div className="divider" />
      <div className="section-label">Seleccioná la unidad</div>

      {loadingDisp && fecha && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-3)', fontSize: 13 }}>⏳ Verificando disponibilidad...</div>
      )}

      {disponibilidad.map(u => {
        const disponible = !fecha || u.disponible;
        const seleccionada = unidadSel?.id === u.id;
        const tipoInfo = TIPO_UNIT[u.tipo] || { icon: '🚌', label: u.tipo };
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
              <span className={`badge ${!fecha ? 'badge-avail' : disponible ? 'badge-avail' : 'badge-unavail'}`}>
                {!fecha ? 'Disponible' : disponible ? 'Disponible' : 'Ocupado'}
              </span>
            </div>
          </div>
        );
      })}

      <button className="btn-primary"
        disabled={!fecha || !unidadSel}
        onClick={() => setStep(2)}>
        Ver presupuesto →
      </button>
      <button className="btn-secondary" onClick={onBack}>← Cambiar tipo de servicio</button>
    </div>
  );
}
