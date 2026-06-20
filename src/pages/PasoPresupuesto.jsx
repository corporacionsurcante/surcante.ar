import React, { useState } from 'react';
import { useDolar } from '../hooks/useDolar';
import { calcPresupuestoTotal, formatARS, formatDate } from '../utils/calculos';
import { METODOS_PAGO, DATOS_BANCARIOS, WHATSAPP } from '../data/pagos';
import { crearPreferenciaMercadoPago } from '../hooks/useMercadoPago';

export default function PasoPresupuesto({ reserva, onBack, onConfirm }) {
  const { dolar, loading } = useDolar();
  const [payMethod, setPayMethod] = useState('mercadopago');
  const [loadingMP, setLoadingMP] = useState(false);
  const [errorMP, setErrorMP] = useState('');

  const { flotaUnidades, syncMode, movData, movKmData, kmTotal,
          origen, destino, fechaInicio, fechaFin, dias, mismodia, horaInicio, horaFin } = reserva;

  const { grandTotal, detalles } = dolar
    ? calcPresupuestoTotal({ flotaUnidades, kmTotal, movData, movKmData, syncMode, dolar, mismodia, dias })
    : { grandTotal: 0, detalles: [] };

  const metodoActual = METODOS_PAGO.find(m => m.id === payMethod);
  const porcentaje = metodoActual?.porcentaje || 0.30;
  const montoAhora = Math.round(grandTotal * porcentaje);
  const saldo = grandTotal - montoAhora;

  function buildWAMsg(nombre) {
    return encodeURIComponent(
      `Hola ${nombre}! Quiero reservar un viaje con Surcante.\n\n` +
      `📍 Origen: ${origen}\n🏁 Destino: ${destino}\n` +
      `📅 Salida: ${fechaInicio} · Regreso: ${fechaFin}\n` +
      `🚌 Unidades: ${flotaUnidades.length}\n` +
      `💰 Total: ${formatARS(grandTotal)}\n` +
      `💳 Método: ${metodoActual?.label}\n` +
      `✅ Pago ahora: ${formatARS(montoAhora)}`
    );
  }

  async function handlePagarMP() {
    setLoadingMP(true);
    setErrorMP('');
    try {
      const pref = await crearPreferenciaMercadoPago({
        grandTotal, montoAhora, origen, destino,
        fechaInicio, fechaFin, flotaUnidades,
      });
      // Guardar reserva antes de redirigir
      onConfirm({ grandTotal, sena: montoAhora, saldo, payMethod, porcentaje, mpPreferenceId: pref.id });
      // Redirigir a MercadoPago
      window.location.href = pref.init_point;
    } catch (e) {
      setErrorMP('No se pudo conectar con MercadoPago. Intentá con transferencia o efectivo.');
      setLoadingMP(false);
    }
  }

  function WhatsAppButtons({ sufijo }) {
    return (
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Enviar por WhatsApp</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {WHATSAPP.map(w => (
            <a key={w.numero}
              href={`https://wa.me/${w.numero}?text=${buildWAMsg(w.nombre)}${sufijo ? encodeURIComponent(sufijo) : ''}`}
              target="_blank" rel="noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '12px 8px', background: '#25D366', borderRadius: 10,
                color: '#fff', textDecoration: 'none', fontWeight: 600,
                fontSize: 13, gap: 4, textAlign: 'center',
              }}>
              <span style={{ fontSize: 20 }}>📱</span>
              {w.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="body">
      <div className="presup-hero">
        <div className="presup-hero-label">Total del viaje</div>
        <div className="presup-hero-val">{loading ? 'Calculando...' : formatARS(grandTotal)}</div>
        <div className="presup-hero-sub">
          {dias} día{dias !== 1 ? 's' : ''} de servicio · {flotaUnidades.length} unidad{flotaUnidades.length !== 1 ? 'es' : ''} · IVA incluido
        </div>
        {!loading && (
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
              <div className="sena-label">Días servicio</div>
              <div className="sena-val">{dias}</div>
            </div>
          </div>
        )}
      </div>

      <div className="section-label">Método de pago</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {METODOS_PAGO.map(m => (
          <div key={m.id} onClick={() => setPayMethod(m.id)} style={{
            border: `1.5px solid ${payMethod === m.id ? 'var(--sp)' : 'var(--border)'}`,
            borderRadius: 12, padding: '12px 14px',
            background: payMethod === m.id ? 'var(--spl)' : 'var(--bg)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: 12, transition: 'all .15s',
          }}>
            <span style={{ fontSize: 22 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: payMethod === m.id ? 'var(--spd)' : 'var(--text)' }}>
                {m.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{m.descripcion}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: payMethod === m.id ? 'var(--sp)' : 'var(--text-2)' }}>
              {formatARS(Math.round(grandTotal * m.porcentaje))}
            </div>
          </div>
        ))}
      </div>

      {/* MercadoPago */}
      {payMethod === 'mercadopago' && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>
            Pagás el <strong>10%</strong> ({formatARS(montoAhora)}) ahora con MercadoPago. El saldo lo coordinamos antes del viaje.
          </div>
          {errorMP && <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>{errorMP}</div>}
          <button onClick={handlePagarMP} disabled={loadingMP || loading}
            style={{
              width: '100%', padding: 13, background: '#009EE3', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: loadingMP ? 'default' : 'pointer', opacity: loadingMP ? .7 : 1,
              fontFamily: 'Inter, sans-serif',
            }}>
            {loadingMP ? 'Redirigiendo...' : `💳 Pagar ${formatARS(montoAhora)} con MercadoPago`}
          </button>
        </div>
      )}

      {/* Tarjeta — via MP */}
      {payMethod === 'tarjeta' && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>
            Pagás el <strong>10%</strong> ({formatARS(montoAhora)}) con tarjeta a través de MercadoPago.
          </div>
          {errorMP && <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>{errorMP}</div>}
          <button onClick={handlePagarMP} disabled={loadingMP || loading}
            style={{
              width: '100%', padding: 13, background: '#6B21D6', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: loadingMP ? 'default' : 'pointer', opacity: loadingMP ? .7 : 1,
              fontFamily: 'Inter, sans-serif',
            }}>
            {loadingMP ? 'Redirigiendo...' : `🏦 Pagar ${formatARS(montoAhora)} con tarjeta`}
          </button>
        </div>
      )}

      {/* Transferencia */}
      {payMethod === 'transferencia' && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Datos bancarios</div>
          {[
            ['Titular', DATOS_BANCARIOS.titular],
            ['Banco', `${DATOS_BANCARIOS.banco} · ${DATOS_BANCARIOS.sucursal}`],
            ['Cuenta', `${DATOS_BANCARIOS.tipoCuenta} ${DATOS_BANCARIOS.numeroCuenta}`],
            ['CBU', DATOS_BANCARIOS.cbu],
            ['CUIT', DATOS_BANCARIOS.cuit],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{value}</span>
            </div>
          ))}
          <div style={{ marginTop: 14 }}>
            <WhatsAppButtons sufijo={'\n\n📎 Te envío el comprobante de transferencia.'} />
          </div>
        </div>
      )}

      {/* Efectivo */}
      {payMethod === 'efectivo' && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <WhatsAppButtons sufijo={'\n\nQuiero coordinar el pago en efectivo.'} />
        </div>
      )}

      <div className="section-label">Resumen</div>
      <div className="pcard">
        <div className="prow"><span>📍 Origen</span><span style={{ fontWeight: 600 }}>{origen}</span></div>
        <div className="prow"><span>🏁 Destino</span><span style={{ fontWeight: 600 }}>{destino}</span></div>
        <div className="prow"><span>📅 Salida</span><span>{formatDate(fechaInicio)}</span></div>
        <div className="prow"><span>📅 Regreso</span><span>{mismodia ? `Mismo día${horaFin ? ' · ' + horaFin : ''}` : formatDate(fechaFin)}</span></div>
        {mismodia && horaInicio && (
          <div className="prow"><span>🕐 Horario</span><span>{horaInicio} → {horaFin}</span></div>
        )}
      </div>

      <div className="section-label">Detalle por unidad</div>
      <div className="pcard">
        {detalles.map((d, idx) => {
          const grupos = d.grupos || {};
          return (
            <div key={d.id}>
              {idx > 0 && <div style={{ height: 6 }} />}
              <div className={`prow hl ${idx > 0 ? 'sep' : ''}`}>
                <span>{d.type.icon} {d.label}</span>
                <span>{formatARS(d.total)}</span>
              </div>
              {d.esPrecioMinimo ? (
                <div className="prow sub" style={{ color: 'var(--sp)' }}>
                  <span>⚡ Tarifa mínima ({d.diasViaje} día{d.diasViaje > 1 ? 's' : ''} · {d.kmPorDia} km/día)</span>
                  <span>{formatARS(d.traslNeto)}</span>
                </div>
              ) : (
                <div className="prow sub"><span>Recorrido {d.kmTotalConExtra?.toLocaleString('es-AR')} km</span><span>{formatARS(d.traslNeto)}</span></div>
              )}
              {d.movNeto > 0 && (
                <>
                  <div className="prow sub"><span>Movimientos en destino</span><span>{formatARS(d.movNeto)}</span></div>
                  {[1,2,3].map(m => grupos[m] > 0 ? (
                    <div key={m} className="prow sub" style={{ paddingLeft: 24 }}>
                      <span>{grupos[m]} día{grupos[m]>1?'s':''} × {m} mov.</span>
                      <span>{formatARS(d.type.movUSD[m-1]*(1-d.type.movDesc)*dolar*grupos[m])}</span>
                    </div>
                  ) : null)}
                </>
              )}
              {d.kmExtra > 0 && (
                <div className="prow sub"><span>Km extra movimientos</span><span>{formatARS(d.kmExtra*d.type.usdKm*dolar)}</span></div>
              )}
              <div className="prow sub"><span>IVA (21%)</span><span>{formatARS(d.ivaTotal)}</span></div>
            </div>
          );
        })}
        <div className="prow total"><span>Total general</span><span>{formatARS(grandTotal)}</span></div>
      </div>

      {(payMethod === 'transferencia' || payMethod === 'efectivo') && (
        <button className="btn-primary green" disabled={loading}
          onClick={() => onConfirm({ grandTotal, sena: montoAhora, saldo, payMethod, porcentaje })}>
          ✓ Confirmar reserva
        </button>
      )}
      <button className="btn-secondary" onClick={onBack}>← Modificar recorrido</button>
    </div>
  );
