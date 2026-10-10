import React, { useEffect, useState } from 'react';
import { suscribirReservas, actualizarEstadoReserva } from '../../firebase/services';
import { formatARS } from '../../utils/calculos';
import { abrirPdfCotizacion } from '../../utils/pdfCotizacion';

const ESTADOS = [
  { key: 'seña_pendiente', label: 'Seña pendiente', clase: 'estado-saldo' },
  { key: 'seña_recibida', label: 'Seña recibida', clase: 'estado-sena' },
  { key: 'saldo_pendiente', label: 'Saldo pendiente', clase: 'estado-saldo' },
  { key: 'confirmada', label: 'Confirmada', clase: 'estado-confirmada' },
  { key: 'cancelada', label: 'Cancelada', clase: 'estado-cancelada' },
];

const FILTROS = ['todas', 'seña_pendiente', 'seña_recibida', 'saldo_pendiente', 'confirmada', 'cancelada'];
const FILTRO_LABEL = { todas: 'Todas', seña_pendiente: 'Seña pend.', seña_recibida: 'Seña recib.', saldo_pendiente: 'Saldo pend.', confirmada: 'Confirmadas', cancelada: 'Canceladas' };

const TIPO_LABEL = {
  charter: '🚌 Charter',
  receptivo: '🏛️ Receptivo',
  disposicion: '⏱️ A disposición',
  'movimientos-caba-gba': '🚐 Mov. CABA/GBA',
};

const PAGO_LABEL = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  mercadopago: 'MercadoPago',
  tarjeta: 'Tarjeta (MercadoPago)',
};

// Texto del servicio según el tipo (charter tiene origen/destino; el resto, unidad/descripción)
function resumenServicio(r) {
  if (r.origen || r.destino) return `${r.origen || '—'} → ${r.destino || '—'}`;
  return [r.unidad, r.horas ? `${r.horas} hs` : '', r.descripcion].filter(Boolean).join(' · ') || '—';
}

function nroDe(r) {
  return r.nroCotizacion || `SRC-${r.id.slice(-6).toUpperCase()}`;
}

function linkWhatsApp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `549${d}`;
  return `https://wa.me/${d}`;
}

export default function Reservas() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [selectedId, setSelectedId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorEstado, setErrorEstado] = useState('');

  useEffect(() => suscribirReservas(
    data => { setReservas(data); setLoading(false); setError(''); },
    e => { setError(e?.code === 'permission-denied' ? 'Sin permiso para leer las reservas (revisá las reglas de Firestore).' : 'No se pudieron cargar las reservas.'); setLoading(false); },
  ), []);

  const filtradas = filtro === 'todas' ? reservas : reservas.filter(r => r.estado === filtro);
  // Se toma siempre la versión en vivo de la reserva abierta
  const selected = reservas.find(r => r.id === selectedId) || null;

  async function cambiarEstado(id, estado) {
    setGuardando(true);
    setErrorEstado('');
    try {
      await actualizarEstadoReserva(id, estado);
    } catch (e) {
      console.error(e);
      setErrorEstado('No se pudo cambiar el estado. Revisá la conexión.');
    }
    setGuardando(false);
  }

  function estadoBadge(estado) {
    const e = ESTADOS.find(x => x.key === estado);
    return <span className={`estado-badge ${e?.clase || ''}`}>{e?.label || estado}</span>;
  }

  if (loading) return <div className="admin-loading">Cargando reservas...</div>;
  if (error) return <div className="admin-empty"><div className="admin-empty-icon">⚠️</div>{error}</div>;

  const fila = (label, valor) => (valor === undefined || valor === null || valor === '' ? null : (
    <div className="modal-row"><span>{label}</span><span>{valor}</span></div>
  ));

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Reservas ({filtradas.length})</div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: '1.5px solid',
              borderColor: filtro === f ? '#8B5CF6' : 'rgba(139,92,246,0.20)',
              background: filtro === f ? '#8B5CF6' : '#fff',
              color: filtro === f ? '#fff' : 'rgba(240,238,255,0.55)',
              fontFamily: 'Inter, sans-serif',
            }}>
            {FILTRO_LABEL[f]}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📋</div>
          No hay reservas en esta categoría
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>N° Reserva</th>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Salida</th>
                <th>Días</th>
                <th>Total</th>
                <th>Seña</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedId(r.id); setErrorEstado(''); }}>
                  <td style={{ fontFamily: 'monospace', color: '#8B5CF6', fontWeight: 700 }}>{nroDe(r)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.clienteNombre || '—'}</div>
                    {r.clienteWhatsapp && <div style={{ fontSize: 11, color: 'rgba(240,238,255,0.45)' }}>📱 {r.clienteWhatsapp}</div>}
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6' }}>{TIPO_LABEL[r.tipo] || TIPO_LABEL.charter}</div>
                    {resumenServicio(r)}
                    {Array.isArray(r.puntosCarga) && r.puntosCarga.length > 0 && (
                      <div style={{ fontSize: 11, color: 'rgba(240,238,255,0.45)' }}>+ {r.puntosCarga.length} punto{r.puntosCarga.length > 1 ? 's' : ''} de carga</div>
                    )}
                  </td>
                  <td>{r.fechaInicio || '—'}</td>
                  <td>{r.horas ? `${r.horas} hs` : (r.dias || r.nights || '—')}</td>
                  <td style={{ fontWeight: 700 }}>{formatARS(r.grandTotal || 0)}</td>
                  <td style={{ color: '#10B981', fontWeight: 700 }}>{formatARS(r.sena || 0)}</td>
                  <td>{estadoBadge(r.estado)}</td>
                  <td style={{ color: '#8B5CF6', fontWeight: 600, fontSize: 12 }}>Ver →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedId(null)}>
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">{nroDe(selected)}</div>
              <button className="modal-close" onClick={() => setSelectedId(null)}>✕</button>
            </div>
            {fila('Servicio', TIPO_LABEL[selected.tipo] || TIPO_LABEL.charter)}
            {fila('Cliente', selected.clienteNombre)}
            {selected.clienteWhatsapp && (
              <div className="modal-row">
                <span>WhatsApp</span>
                <span>
                  {linkWhatsApp(selected.clienteWhatsapp)
                    ? <a href={linkWhatsApp(selected.clienteWhatsapp)} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 700, textDecoration: 'none' }}>📱 {selected.clienteWhatsapp}</a>
                    : selected.clienteWhatsapp}
                </span>
              </div>
            )}
            {fila('Base de salida', selected.baseNombre)}
            {fila('Origen', selected.origen)}
            {fila('Destino', selected.destino)}
            {Array.isArray(selected.puntosCarga) && selected.puntosCarga.length > 0 && fila('Puntos de carga', selected.puntosCarga.join(' · '))}
            {fila('Unidad', selected.unidad)}
            {fila('Salida', selected.fechaInicio)}
            {selected.fechaFin !== selected.fechaInicio && fila('Regreso', selected.fechaFin)}
            {selected.mismodia && fila('Horario', `${selected.horaInicio || '—'} a ${selected.horaFin || '—'}`)}
            {fila('Días de servicio', selected.horas ? null : selected.dias)}
            {fila('Horas', selected.horas ? `${selected.horas} hs` : null)}
            {fila('Tarifa', selected.detallePrecio)}
            {fila('Descripción', selected.descripcion)}
            {selected.kmTotal ? fila('Km totales', `${Number(selected.kmTotal).toLocaleString('es-AR')} km`) : null}
            {Array.isArray(selected.flotaUnidades) && selected.flotaUnidades.length > 0 && fila('Unidades', selected.flotaUnidades.map(u => u.label || u.id).join(' · '))}
            {Array.isArray(selected.programaResumen) && selected.programaResumen.map(p => (
              <div key={p.dia} className="modal-row"><span>Día {p.dia}</span><span>{p.actividades}</span></div>
            ))}
            <div className="modal-row"><span>Total</span><span style={{ color: '#8B5CF6', fontWeight: 800 }}>{formatARS(selected.grandTotal || 0)}</span></div>
            <div className="modal-row"><span>Seña{selected.porcentaje ? ` (${Math.round(selected.porcentaje * 100)}%)` : ''}</span><span style={{ color: '#10B981', fontWeight: 700 }}>{formatARS(selected.sena || 0)}</span></div>
            <div className="modal-row"><span>Saldo</span><span>{formatARS(selected.saldo != null ? selected.saldo : (selected.grandTotal || 0) - (selected.sena || 0))}</span></div>
            {fila('Método de pago', PAGO_LABEL[selected.payMethod] || selected.payMethod)}
            {fila('MercadoPago', selected.mpPreferenceId ? `Preferencia ${selected.mpPreferenceId}` : null)}

            <button onClick={() => abrirPdfCotizacion(selected)}
              style={{ marginTop: 14, width: '100%', border: '1.5px solid rgba(139,92,246,0.20)', background: '#131324', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
              📄 Ver PDF del presupuesto
            </button>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(139,92,246,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(240,238,255,0.45)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Cambiar estado
              </div>
              <div className="modal-estado-row">
                {ESTADOS.map(e => (
                  <button key={e.key}
                    disabled={guardando}
                    className={`modal-estado-btn ${selected.estado === e.key ? 'active' : ''}`}
                    onClick={() => cambiarEstado(selected.id, e.key)}>
                    {e.label}
                  </button>
                ))}
              </div>
              {errorEstado && <div style={{ marginTop: 10, color: '#EF4444', fontSize: 12, fontWeight: 600 }}>{errorEstado}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
