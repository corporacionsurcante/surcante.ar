import React, { useState, useEffect } from 'react';
import { useDolar } from '../hooks/useDolar';
import { useDisponibilidad } from '../hooks/useDisponibilidad';
import { getDiasServicio, formatARS, formatDate } from '../utils/calculos';
import { CITY_TOUR_USD, CIRCUITOS, TRANSFERS_AEROPUERTO } from '../data/receptivo';
import { suscribirPreciosCityTour, suscribirCircuitos, suscribirTransfers } from '../firebase/receptivoServices';
import Calendario from '../components/Calendario';
import { crearPreferenciaMercadoPago } from '../hooks/useMercadoPago';
import { guardarReserva } from '../firebase/reservasService';
import { generarNroCotizacion } from '../utils/pdfCotizacion';
import ReservaConfirmada from '../components/ReservaConfirmada';

const TIPO_UNIT = {
  'MIX 60':     { icon: '🚌', label: 'Omnibus doble piso / 60 but.' },
  'Comun 45':   { icon: '🚌', label: 'Omnibus 45 butacas' },
  'Minibus 24': { icon: '🚐', label: 'Minibus 24 butacas' },
  'Minibus 19': { icon: '🚐', label: 'Minibus 19 butacas' },
};

export default function ReceptivoCotizador({ onBack, initialContacto }) {
  const { dolar, loading: loadingDolar } = useDolar();
  const [cityTourPrecios, setCityTourPrecios] = useState(null);
  const [circuitosDB, setCircuitosDB] = useState(null);
  const [transfersDB, setTransfersDB] = useState(null);
  const [step, setStep] = useState(1);
  const [fechas, setFechas] = useState({ fechaInicio: '', fechaFin: '', mismodia: false, dias: 1 });
  const [unidadSel, setUnidadSel] = useState(null);
  const [programa, setPrograma] = useState([]);
  const [diaEditando, setDiaEditando] = useState(1);
  const [payMethod, setPayMethod] = useState('transferencia');
  const [loadingMP, setLoadingMP] = useState(false);
  const [errorMP, setErrorMP] = useState('');
  const [reservaOk, setReservaOk] = useState(null);
  const [contacto, setContacto] = useState({
    nombre: initialContacto?.nombreCompleto || '',
    whatsapp: initialContacto?.whatsapp || '',
  });
  const contactoValido = contacto.nombre.trim().length > 1 && contacto.whatsapp.trim().length >= 8;

  useEffect(() => {
    const u1 = suscribirPreciosCityTour(setCityTourPrecios);
    const u2 = suscribirCircuitos(setCircuitosDB);
    const u3 = suscribirTransfers(setTransfersDB);
    return () => { u1(); u2(); u3(); };
  }, []);

  const preciosCityTour = cityTourPrecios || CITY_TOUR_USD;
  const circuitosActivos = (circuitosDB || CIRCUITOS).filter(c => c.activo !== false);
  const transfersActivos = (transfersDB || TRANSFERS_AEROPUERTO).filter(t => t.activo !== false);
  const { disponibilidad, loading: loadingDisp } = useDisponibilidad(fechas.fechaInicio, fechas.fechaFin);
  const dias = fechas.dias || 1;

  function getPrecioItem(item) {
    if (!unidadSel || !dolar) return 0;
    const tipo = unidadSel.tipo;
    if (item.tipo === 'city') return (preciosCityTour[tipo] || 0) * dolar;
    if (item.tipo === 'circuito') {
      const circ = circuitosActivos.find(c => c.id === item.id);
      return circ ? (circ.precioUSD?.[tipo] || 0) * dolar : 0;
    }
    if (item.tipo === 'transfer') {
      const tr = transfersActivos.find(t => t.id === item.id);
      return tr ? tr.precioUSD * dolar : 0;
    }
    return 0;
  }

  function getPrecioDia(diaNum) {
    const dia = programa.find(p => p.dia === diaNum);
    if (!dia || !dia.items || dia.items.length === 0) return 0;
    return dia.items.reduce((sum, item) => sum + getPrecioItem(item), 0);
  }

  function getNombreItem(item) {
    if (item.tipo === 'city') return '🏛️ City Tour CABA';
    if (item.tipo === 'circuito') {
      const circ = circuitosActivos.find(c => c.id === item.id);
      return circ ? `${circ.emoji} ${circ.nombre}` : item.nombre;
    }
    if (item.tipo === 'transfer') {
      const tr = transfersActivos.find(t => t.id === item.id);
      return tr ? `${tr.emoji} ${tr.nombre}` : item.nombre;
    }
    return null;
  }

  function getNombreDia(diaNum) {
    const dia = programa.find(p => p.dia === diaNum);
    if (!dia || !dia.items || dia.items.length === 0) return null;
    return dia.items.map(getNombreItem).filter(Boolean).join(' + ');
  }

  function tieneItem(diaNum, tipo, id) {
    const dia = programa.find(p => p.dia === diaNum);
    if (!dia || !dia.items) return false;
    const itemId = id || tipo;
    return dia.items.some(i => i.tipo === tipo && i.id === itemId);
  }

  function toggleItem(tipo, id, nombre) {
    setPrograma(prev => {
      const itemId = id || tipo;
      const diaActual = prev.find(p => p.dia === diaEditando);
      if (!diaActual) {
        return [...prev, { dia: diaEditando, items: [{ tipo, id: itemId, nombre }] }];
      }
      const tieneEste = diaActual.items.some(i => i.tipo === tipo && i.id === itemId);
      const nuevosItems = tieneEste
        ? diaActual.items.filter(i => !(i.tipo === tipo && i.id === itemId))
        : [...diaActual.items, { tipo, id: itemId, nombre }];
      const sinDia = prev.filter(p => p.dia !== diaEditando);
      if (nuevosItems.length === 0) return sinDia;
      return [...sinDia, { dia: diaEditando, items: nuevosItems }];
    });
  }

  function limpiarDia(diaNum) {
    setPrograma(prev => prev.filter(p => p.dia !== diaNum));
  }

  const subtotal = Array.from({ length: dias }, (_, i) => getPrecioDia(i + 1)).reduce((a, b) => a + b, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  const diasConPrograma = programa.filter(p => p.items && p.items.length > 0).length;

  // ---- PASO 3: PRESUPUESTO ----
  const METODOS = [
    { id: 'transferencia', label: 'Transferencia', icon: '🏛️', desc: '30% para confirmar', porc: 0.30 },
    { id: 'efectivo',      label: 'Efectivo',      icon: '💵', desc: 'Coordinás por WhatsApp', porc: 0.30 },
    { id: 'mercadopago',   label: 'MercadoPago',   icon: '💳', desc: '10% ahora online', porc: 0.10 },
    { id: 'tarjeta',       label: 'Tarjeta',       icon: '🏦', desc: '10% ahora online', porc: 0.10 },
  ];
  const metodoActual = METODOS.find(m => m.id === payMethod) || METODOS[0];
  const montoAhora = Math.round(total * metodoActual.porc);
  const saldoPendiente = total - montoAhora;

  const DATOS_BANCARIOS = {
    titular: 'SURCANTE S.R.L', banco: 'Banco Macro · Suc. 544',
    cuenta: 'Cta Cte $ 3-5440941641566-6', cbu: '2850544230094164156661', cuit: '30-71098078-7',
  };
  const WHATSAPP_LIST = [
    { label: 'José', numero: '5491158100414', nombre: 'José Bournissen' },
    { label: 'Sebastián', numero: '5492984524724', nombre: 'Sebastián Machado' },
  ];

  function buildWAMsg(nombre) {
    return encodeURIComponent(
      `Hola ${nombre}! Quiero reservar servicio receptivo con Surcante.\n\n` +
      `📅 Fechas: ${fechas.fechaInicio} → ${fechas.fechaFin}\n` +
      `🚌 Unidad: ${unidadSel?.tipo} · INTERNO ${unidadSel?.interno}\n` +
      `💰 Total: ${formatARS(total)}\n` +
      `💳 Método: ${metodoActual.label}\n` +
      `✅ Pago ahora: ${formatARS(montoAhora)}`
    );
  }

  if (reservaOk) return <ReservaConfirmada datos={reservaOk} onNueva={onBack} />;

  if (step === 3) {
    return (
      <div className="body">
        <div className="presup-hero">
          <div className="presup-hero-label">Total del servicio</div>
          <div className="presup-hero-val">{loadingDolar ? 'Calculando...' : formatARS(total)}</div>
          <div className="presup-hero-sub">
            {dias} día{dias > 1 ? 's' : ''} de servicio · {unidadSel?.tipo} · Impuestos incluidos
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
                <div className="sena-val">{formatARS(saldoPendiente)}</div>
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
          <div className="prow hl"><span>Unidad</span><span>{unidadSel?.tipo} · INTERNO {unidadSel?.interno}</span></div>
          <div className="prow"><span>Fechas</span><span>{formatDate(fechas.fechaInicio)} → {formatDate(fechas.fechaFin)}</span></div>
          <div style={{ height: 8 }} />
          {Array.from({ length: dias }, (_, i) => {
            const diaNum = i + 1;
            const diaData = programa.find(p => p.dia === diaNum);
            const items = diaData?.items || [];
            return (
              <div key={diaNum}>
                {items.length === 0 ? (
                  <div className="prow">
                    <span style={{ color: 'var(--text-3)' }}>Día {diaNum} · Sin asignar</span>
                    <span>—</span>
                  </div>
                ) : items.map((item, idx) => (
                  <div key={idx} className="prow">
                    <span>Día {diaNum} · {getNombreItem(item)}</span>
                    <span style={{ fontWeight: 600 }}>{formatARS(getPrecioItem(item))}</span>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="prow"><span>Con impuestos</span><span>{formatARS(iva)}</span></div>
          <div className="prow total"><span>Total</span><span>{formatARS(total)}</span></div>
        </div>

        <div className="section-label">Método de pago</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {METODOS.map(m => (
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

        {/* Panel transferencia */}
        {payMethod === 'transferencia' && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Datos bancarios</div>
            {Object.entries(DATOS_BANCARIOS).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)', fontWeight: 500, textTransform: 'capitalize' }}>{k}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Enviar comprobante por WhatsApp</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {WHATSAPP_LIST.map(w => (
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

        {/* Panel efectivo */}
        {payMethod === 'efectivo' && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Contactar por WhatsApp</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {WHATSAPP_LIST.map(w => (
                <a key={w.numero} href={`https://wa.me/${w.numero}?text=${buildWAMsg(w.nombre)}${encodeURIComponent('\n\nQuiero coordinar el pago en efectivo.')}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', background: '#25D366', borderRadius: 10, color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13, gap: 4 }}>
                  <span style={{ fontSize: 20 }}>📱</span>{w.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Panel MP / Tarjeta */}
        {(payMethod === 'mercadopago' || payMethod === 'tarjeta') && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>
              Pagás el <strong>10%</strong> ({formatARS(montoAhora)}) ahora online. El saldo lo coordinamos antes del servicio.
            </div>
            {errorMP && (
              <div style={{ fontSize: 12, color: '#CF1322', background: '#FFF1F0', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                {errorMP}
              </div>
            )}
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
              const datos = {
                tipo: 'receptivo',
                nroCotizacion: generarNroCotizacion(),
                clienteNombre: contacto.nombre,
                clienteWhatsapp: contacto.whatsapp,
                unidad: `${unidadSel?.tipo} · INTERNO ${unidadSel?.interno}`,
                fechaInicio: fechas.fechaInicio,
                fechaFin: fechas.fechaFin,
                dias,
                programa,
                programaResumen: Array.from({ length: dias }, (_, i) => ({
                  dia: i + 1,
                  actividades: getNombreDia(i + 1) || 'Día libre',
                })),
                grandTotal: total,
                sena: montoAhora,
                saldo: saldoPendiente,
                payMethod,
              };
              try {
                await guardarReserva(datos);
              } catch(e) { console.error('Error guardando reserva:', e); }
              setReservaOk(datos);
            }}>
            ✓ Confirmar y reservar
          </button>
        )}

        {(payMethod === 'mercadopago' || payMethod === 'tarjeta') && (
          <button className="btn-primary"
            disabled={loadingMP || loadingDolar}
            style={{ background: payMethod === 'mercadopago' ? '#009EE3' : '#6B21D6', opacity: loadingMP ? .7 : 1 }}
            onClick={async () => {
              setLoadingMP(true);
              setErrorMP('');
              try {
                const pref = await crearPreferenciaMercadoPago({
                  grandTotal: total,
                  montoAhora,
                  origen: 'Buenos Aires',
                  destino: 'Receptivo CABA',
                  fechaInicio: fechas.fechaInicio,
                  fechaFin: fechas.fechaFin,
                  flotaUnidades: [{ id: unidadSel?.id, label: `INTERNO ${unidadSel?.interno}` }],
                });
                window.location.href = pref.init_point;
              } catch (e) {
                setErrorMP('No se pudo conectar con MercadoPago. Intentá con transferencia o efectivo.');
                setLoadingMP(false);
              }
            }}>
            {loadingMP ? 'Redirigiendo...' : `${payMethod === 'mercadopago' ? '💳' : '🏦'} Pagar ${formatARS(montoAhora)} ${payMethod === 'mercadopago' ? 'con MercadoPago' : 'con tarjeta'}`}
          </button>
        )}

        <button className="btn-secondary" onClick={() => setStep(2)}>← Modificar programa</button>
      </div>
    );
  }

  // ---- PASO 2: PROGRAMA DÍA POR DÍA ----
  if (step === 2) {
    const itemsDiaActual = programa.find(p => p.dia === diaEditando)?.items || [];

    return (
      <div className="body">
        <div className="section-label">Programa del servicio · {dias} día{dias > 1 ? 's' : ''}</div>

        {/* Chips de días */}
        <div className="grid-dias" style={{ marginBottom: 14 }}>
          {Array.from({ length: dias }, (_, i) => {
            const diaNum = i + 1;
            const cantItems = programa.find(p => p.dia === diaNum)?.items?.length || 0;
            const nombre = getNombreDia(diaNum);
            return (
              <div key={diaNum}
                className={`dia-chip ${cantItems > 0 ? 'activo' : ''} ${diaEditando === diaNum ? 'editando' : ''}`}
                onClick={() => setDiaEditando(diaNum)}>
                <div className="dia-chip-num">D{diaNum}</div>
                <div className="dia-chip-mov" style={{ fontSize: 11 }}>{cantItems || '—'}</div>
                <div className="dia-chip-lbl" style={{ fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nombre ? nombre.slice(0, 6) : 'elegir'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel del día */}
        <div style={{ background: 'var(--spl)', border: '1px solid var(--spm)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--spd)' }}>
              Día {diaEditando} — ¿qué hace el grupo?
            </div>
            {itemsDiaActual.length > 0 && (
              <button
                onClick={() => limpiarDia(diaEditando)}
                style={{ background: 'none', border: '1px solid var(--spm)', borderRadius: 7, padding: '4px 10px', color: 'var(--sp)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                ✕ Limpiar
              </button>
            )}
          </div>

          {/* SECCIÓN 1: Transfer aeropuerto */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Transfer aeropuerto
          </div>
          {transfersActivos.map(t => {
            const sel = tieneItem(diaEditando, 'transfer', t.id);
            return (
              <div key={t.id}
                onClick={() => toggleItem('transfer', t.id, t.nombre)}
                style={{
                  border: `1.5px solid ${sel ? 'var(--sp)' : 'var(--spm)'}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                  background: sel ? 'var(--sp)' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <span style={{ fontSize: 18 }}>{t.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: sel ? '#fff' : 'var(--spd)' }}>{t.nombre}</div>
                  <div style={{ fontSize: 11, color: sel ? 'rgba(255,255,255,.7)' : 'var(--text-3)' }}>{t.descripcion}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sel ? '#fff' : 'var(--sp)' }}>
                    {formatARS(t.precioUSD * (dolar || 0))}
                  </div>
                  {sel && <div style={{ color: '#fff', fontSize: 12 }}>✓</div>}
                </div>
              </div>
            );
          })}

          {/* SECCIÓN 2: City Tour */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 }}>
            City Tour CABA
          </div>
          {(() => {
            const sel = tieneItem(diaEditando, 'city', 'city');
            return (
              <div
                onClick={() => toggleItem('city', 'city', 'City Tour CABA')}
                style={{
                  border: `1.5px solid ${sel ? 'var(--sp)' : 'var(--spm)'}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
                  background: sel ? 'var(--sp)' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <span style={{ fontSize: 20 }}>🏛️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: sel ? '#fff' : 'var(--spd)' }}>City Tour CABA</div>
                  <div style={{ fontSize: 11, color: sel ? 'rgba(255,255,255,.7)' : 'var(--sp)' }}>
                    {formatARS((preciosCityTour[unidadSel?.tipo] || 0) * (dolar || 0))} · con impuestos
                  </div>
                </div>
                {sel && <span style={{ color: '#fff', fontWeight: 700 }}>✓</span>}
              </div>
            );
          })()}

          {/* SECCIÓN 3: Circuitos especiales */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 }}>
            Circuitos especiales
          </div>
          {circuitosActivos.map(c => {
            const sel = tieneItem(diaEditando, 'circuito', c.id);
            return (
              <div key={c.id}
                onClick={() => toggleItem('circuito', c.id, c.nombre)}
                style={{
                  border: `1.5px solid ${sel ? 'var(--sp)' : 'var(--spm)'}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                  background: sel ? 'var(--sp)' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <span style={{ fontSize: 18 }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: sel ? '#fff' : 'var(--spd)' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: sel ? 'rgba(255,255,255,.7)' : 'var(--text-3)' }}>{c.descripcion}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sel ? '#fff' : 'var(--sp)' }}>
                    {formatARS((c.precioUSD?.[unidadSel?.tipo] || 0) * (dolar || 0))}
                  </div>
                  {sel && <div style={{ color: '#fff', fontSize: 12 }}>✓</div>}
                </div>
              </div>
            );
          })}

          {/* Resumen de items seleccionados del día */}
          {itemsDiaActual.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(107,33,214,.08)', borderRadius: 8, fontSize: 12, color: 'var(--spd)', fontWeight: 500 }}>
              ✓ {itemsDiaActual.length} servicio{itemsDiaActual.length > 1 ? 's' : ''} seleccionado{itemsDiaActual.length > 1 ? 's' : ''} · {formatARS(getPrecioDia(diaEditando))}
            </div>
          )}
        </div>

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

  // ---- PASO 1: SELECCIÓN DE UNIDAD Y FECHAS ----
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
        const precioDia = dolar ? (preciosCityTour[u.tipo] || 0) * dolar : null;
        return (
          <div key={u.id}
            className={`unit-card ${seleccionada ? 'selected' : ''} ${!disponible ? 'unavailable' : ''}`}
            onClick={() => disponible && setUnidadSel(u)}>
            <div className="unit-card-header">
              <div className="unit-ico">{tipoInfo.icon}</div>
              <div className="unit-info">
                <div className="unit-name">INTERNO {u.interno} · {u.patente}</div>
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
