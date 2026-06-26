import React, { useEffect, useState } from 'react';
import { suscribirReservas, actualizarEstadoReserva } from '../../firebase/services';
import { formatARS } from '../../utils/calculos';

const ESTADOS = [
  { key: 'seña_pendiente', label: 'Seña pendiente', clase: 'estado-saldo' },
  { key: 'seña_recibida', label: 'Seña recibida', clase: 'estado-sena' },
  { key: 'saldo_pendiente', label: 'Saldo pendiente', clase: 'estado-saldo' },
  { key: 'confirmada', label: 'Confirmada', clase: 'estado-confirmada' },
  { key: 'cancelada', label: 'Cancelada', clase: 'estado-cancelada' },
];

const FILTROS = ['todas', 'seña_pendiente', 'seña_recibida', 'saldo_pendiente', 'confirmada', 'cancelada'];
const FILTRO_LABEL = { todas: 'Todas', seña_pendiente: 'Seña pend.', seña_recibida: 'Seña recib.', saldo_pendiente: 'Saldo pend.', confirmada: 'Confirmadas', cancelada: 'Canceladas' };

export default function Reservas() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = suscribirReservas(data => { setReservas(data); setLoading(false); });
    return unsub;
  }, []);

  const filtradas = filtro === 'todas' ? reservas : reservas.filter(r => r.estado === filtro);

  async function cambiarEstado(id, estado) {
    await actualizarEstadoReserva(id, estado);
    setSelected(prev => prev ? { ...prev, estado } : null);
  }

  function estadoBadge(estado) {
    const e = ESTADOS.find(x => x.key === estado);
    return <span className={`estado-badge ${e?.clase || ''}`}>{e?.label || estado}</span>;
  }

  if (loading) return <div className="admin-loading">Cargando reservas...</div>;

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
              borderColor: filtro === f ? '#7B2FBE' : '#EDE8F8',
              background: filtro === f ? '#7B2FBE' : '#fff',
              color: filtro === f ? '#fff' : '#4A4A6A',
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
                <th>Origen → Destino</th>
                <th>Salida</th>
                <th>Noches</th>
                <th>Total</th>
                <th>Seña</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                  <td style={{ fontFamily: 'monospace', color: '#7B2FBE', fontWeight: 700 }}>
                    SRC-{r.id.slice(-6).toUpperCase()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.clienteNombre || '—'}</div>
                    {r.clienteWhatsapp && <div style={{ fontSize: 11, color: '#9090B0' }}>📱 {r.clienteWhatsapp}</div>}
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.origen} → {r.destino}
                  </td>
                  <td>{r.fechaInicio || '—'}</td>
                  <td>{r.nights || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{formatARS(r.grandTotal || 0)}</td>
                  <td style={{ color: '#00C896', fontWeight: 700 }}>{formatARS(r.sena || 0)}</td>
                  <td>{estadoBadge(r.estado)}</td>
                  <td style={{ color: '#7B2FBE', fontWeight: 600, fontSize: 12 }}>Ver →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">SRC-{selected.id.slice(-6).toUpperCase()}</div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-row"><span>Origen</span><span>{selected.origen}</span></div>
            <div className="modal-row"><span>Destino</span><span>{selected.destino}</span></div>
            <div className="modal-row"><span>Salida</span><span>{selected.fechaInicio}</span></div>
            <div className="modal-row"><span>Regreso</span><span>{selected.fechaFin}</span></div>
            <div className="modal-row"><span>Noches</span><span>{selected.nights}</span></div>
            <div className="modal-row"><span>Km totales</span><span>{selected.kmTotal?.toLocaleString('es-AR')} km</span></div>
            <div className="modal-row"><span>Unidades</span><span>{selected.flotaUnidades?.length || 1}</span></div>
            <div className="modal-row"><span>Total</span><span style={{ color: '#7B2FBE', fontWeight: 800 }}>{formatARS(selected.grandTotal || 0)}</span></div>
            <div className="modal-row"><span>Seña (30%)</span><span style={{ color: '#00C896', fontWeight: 700 }}>{formatARS(selected.sena || 0)}</span></div>
            <div className="modal-row"><span>Saldo</span><span>{formatARS(selected.saldo || 0)}</span></div>
            <div className="modal-row"><span>Método de pago</span><span style={{ textTransform: 'capitalize' }}>{selected.payMethod}</span></div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F4F2FA' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9090B0', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Cambiar estado
              </div>
              <div className="modal-estado-row">
                {ESTADOS.map(e => (
                  <button key={e.key}
                    className={`modal-estado-btn ${selected.estado === e.key ? 'active' : ''}`}
                    onClick={() => cambiarEstado(selected.id, e.key)}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
