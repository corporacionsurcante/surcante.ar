import React, { useState, useEffect } from 'react';
import { useDolar } from '../hooks/useDolar';
import { formatARS, formatDate, getDiasServicio } from '../utils/calculos';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { DATOS_BANCARIOS, WHATSAPP } from '../data/pagos';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import Calendario from '../components/Calendario';

const PRECIO_DEFAULT_USD = 650;

const TIPO_UNIT = {
  'MIX 60':     { icon: '🚌', label: 'Omnibus Mix 60' },
  'Comun 45':   { icon: '🚌', label: 'Omnibus Común 45' },
  'Minibus 24': { icon: '🚐', label: 'Minibus 24 butacas' },
  'Minibus 19': { icon: '🚐', label: 'Minibus 19 butacas' },
};

export default function MovimientosCotizador({ onBack }) {
  const { dolar, loading: loadingDolar } = useDolar();
  const [precioUSD, setPrecioUSD] = useState(PRECIO_DEFAULT_USD);
  const [fechas, setFechas] = useState({ fechaInicio: '', fechaFin: '', dias: 1 });
  const [unidadSel, setUnidadSel] = useState(null);
  const [payMethod, setPayMethod] = useState('transferencia');
  const [descripcion, setDescripcion] = useState('');
  const [step, setStep] = useState(1);

  const { disponibilidad, loading: loadingDisp } = useDisponibilidad(fechas.fechaInicio, fechas.fechaFin);
  const dias = fechas.dias || 1;

  // Leer precio desde Firebase admin
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'receptivo_movimientos'), snap => {
      if (snap.exists() && snap.data().precioUSD) setPrecioUSD(snap.data().precioUSD);
    });
    return unsub;
  }, []);

  const subtotalDia = precioUSD * (dolar || 0);
  const subtotal = subtotalDia * dias;
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  const montoAhora = Math.round(total * (payMethod === 'mercadopago' || payMethod === 'tarjeta' ? 0.10 : 0.30));
  const saldo = total - montoAhora;

  function buildWAMsg(nombre) {
    return encodeURIComponent(
      `Hola ${nombre}! Quiero reservar movimientos con Surcante.\n\n` +
      `📅 Fecha: ${fechas.fechaInicio}${dias > 1 ? ` → ${fechas.fechaFin}` : ''}\n` +
      `⏱️ Días: ${dias}\n` +
      `📝 Descripción: ${descripcion || 'Sin especificar'}\n` +
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
            {dias} día{dias > 1 ? 's' : ''} · {unidadSel?.tipo} · Impuestos incluidos
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
                <div className="sena-label">Días</div>
                <div className="sena-val">{dias}</div>
              </div>
            </div>
          )}
        </div>

        <div className="section-label">Detalle del servicio</div>
        <div className="pcard">
          <div className="prow hl"><span>🚐 Movimientos CABA / GBA</span><span>{formatARS(subtotal)}</span></div>
          <div className="prow"><span>Unidad</span><span>{unidadSel?.tipo} · Int. {unidadSel?.interno} · {unidadSel?.patente}</span></div>
          <div className="prow"><span>Fechas</span><span>{formatDate(fechas.fechaInicio)}{dias > 1 ? ` → ${formatDate(fechas.fechaFin)}` : ''}</span></div>
          {descripcion && <div className="prow"><span>Descripción</span><span>{descripcion}</span></div>}
          <div className="prow sub"><span>Con impuestos</span><span>{formatARS(iva)}</span></div>
          <div className="prow total"><span>Total</span><span>{formatARS(total)}</span></div>
        </div>

        <div className="section-label">Método de pago</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {[
            { id: 'transferencia', label: 'Transferencia', icon: '🏛️', desc: '30% para confirmar', porc: 0.30 },
            { id: 'efectivo',      label: 'Efectivo',      icon: '💵', desc: 'Coordinás por WhatsApp', porc: 0.30 },
            { id: 'mercadopago',   label: 'MercadoPago',   icon: '💳', desc: '10% ahora online', porc: 0.10 },
            { id: 'tarjeta',       label: 'Tarjeta',       icon: '🏦', desc: '10% ahora online', porc: 0.10 },
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

        {(payMethod === 'transferencia' || payMethod === 'efectivo') && (
          <button className="btn-primary green"
            onClick={() => alert('¡Reserva recibida! Te contactamos a la brevedad para confirmar.')}>
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
      <div className="section-label">Fechas del servicio</div>
      <Calendario onChange={f => setFechas({ ...f, dias: f.mismodia ? 1 : getDiasServicio(f.fechaInicio, f.fechaFin) })} />

      <div className="divider" />
      <div className="section-label">Descripción del servicio (opcional)</div>
      <input
        type="text"
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
        placeholder="ej: Traslado al estadio, evento corporativo, etc."
        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: 16 }}
      />

      <div className="divider" />
      <div className="section-label">Seleccioná la unidad</div>

      {loadingDisp && fechas.fechaInicio && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-3)', fontSize: 13 }}>⏳ Verificando disponibilidad...</div>
      )}

      {disponibilidad.map(u => {
        const disponible = !fechas.fechaInicio || u.disponible;
        const seleccionada = unidadSel?.id === u.id;
        const tipoInfo = TIPO_UNIT[u.tipo] || { icon: '🚌', label: u.tipo };
        const precioDia = dolar ? precioUSD * dolar : null;
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
        disabled={!unidadSel || !fechas.fechaInicio}
        onClick={() => setStep(2)}>
        Ver presupuesto →
      </button>
      <button className="btn-secondary" onClick={onBack}>← Cambiar tipo de servicio</button>
    </div>
  );
}
