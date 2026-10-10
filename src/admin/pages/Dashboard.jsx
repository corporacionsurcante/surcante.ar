import React, { useEffect, useState } from 'react';
import { suscribirReservas } from '../../firebase/services';
import { formatARS } from '../../utils/calculos';

const ESTADOS = {
  seña_pendiente: 'Seña pendiente',
  seña_recibida: 'Seña recibida',
  saldo_pendiente: 'Saldo pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
};

export default function Dashboard() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => suscribirReservas(
    data => { setReservas(data); setLoading(false); setError(''); },
    e => { setError(e?.code === 'permission-denied' ? 'Sin permiso para leer las reservas (revisá las reglas de Firestore).' : 'No se pudieron cargar las reservas.'); setLoading(false); },
  ), []);

  const hoy = new Date().toDateString();
  const reservasHoy = reservas.filter(r => r.creadoEn?.toDate?.()?.toDateString() === hoy);
  const totalMes = reservas.filter(r => {
    const d = r.creadoEn?.toDate?.();
    const ahora = new Date();
    return d && d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  });
  // Solo señas efectivamente cobradas (no las pendientes)
  const ESTADOS_COBRADOS = ['seña_recibida', 'saldo_pendiente', 'confirmada'];
  const ingresosMes = totalMes
    .filter(r => ESTADOS_COBRADOS.includes(r.estado))
    .reduce((acc, r) => acc + (r.sena || 0), 0);
  const cotizadoMes = totalMes.filter(r => r.estado !== 'cancelada').reduce((acc, r) => acc + (r.grandTotal || 0), 0);
  const reservasActivas = reservas.filter(r => r.estado !== 'cancelada');
  const pendientesConfirmar = reservas.filter(r => r.estado === 'seña_pendiente' || r.estado === 'seña_recibida');

  const recientes = reservas.slice(0, 5);

  function estadoBadge(estado) {
    const clases = {
      seña_pendiente: 'estado-badge estado-saldo',
      seña_recibida: 'estado-badge estado-sena',
      saldo_pendiente: 'estado-badge estado-saldo',
      confirmada: 'estado-badge estado-confirmada',
      cancelada: 'estado-badge estado-cancelada',
    };
    return <span className={clases[estado] || 'estado-badge'}>{ESTADOS[estado] || estado}</span>;
  }

  if (loading) return <div className="admin-loading">Cargando...</div>;
  if (error) return <div className="admin-empty"><div className="admin-empty-icon">⚠️</div>{error}</div>;

  return (
    <div>
      <div className="metrics-grid">
        <div className="metric-card dark">
          <div className="metric-label">Reservas hoy</div>
          <div className="metric-val purple">{reservasHoy.length}</div>
          <div className="metric-sub">Nuevas cotizaciones</div>
        </div>
        <div className="metric-card dark">
          <div className="metric-label">Ingresos del mes</div>
          <div className="metric-val green">{formatARS(ingresosMes)}</div>
          <div className="metric-sub">Señas cobradas · {formatARS(cotizadoMes)} cotizado</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Reservas activas</div>
          <div className="metric-val purple">{reservasActivas.length}</div>
          <div className="metric-sub">No canceladas · histórico</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Por confirmar</div>
          <div className="metric-val" style={{ color: pendientesConfirmar.length > 0 ? '#E8A000' : '#10B981' }}>
            {pendientesConfirmar.length}
          </div>
          <div className="metric-sub">Requieren atención</div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Últimas reservas</div>
      </div>

      {recientes.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📋</div>
          Aún no hay reservas. Cuando los clientes coticen aparecerán acá.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>N° Reserva</th>
                <th>Servicio</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', color: '#8B5CF6', fontWeight: 700 }}>SRC-{r.id.slice(-6).toUpperCase()}</td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, marginRight: 6,
                      background: r.tipo === 'receptivo' ? 'rgba(139,92,246,0.15)' : r.tipo === 'disposicion' ? 'rgba(245,158,11,0.15)' : r.tipo === 'movimientos-caba-gba' ? 'rgba(45,212,191,0.12)' : 'rgba(139,92,246,0.08)',
                      color: r.tipo === 'receptivo' ? '#8B5CF6' : r.tipo === 'disposicion' ? '#F59E0B' : r.tipo === 'movimientos-caba-gba' ? '#2DD4BF' : 'rgba(240,238,255,0.65)',
                    }}>
                      {r.tipo === 'receptivo' ? '🏛️ Receptivo' : r.tipo === 'disposicion' ? '⏱️ Disposición' : r.tipo === 'movimientos-caba-gba' ? '🚐 Mov. CABA/GBA' : '🚌 Charter'}
                    </span>
                    {r.origen ? `${r.origen} → ${r.destino}` : r.descripcion || r.unidad || '—'}
                  </td>
                  <td>{r.clienteNombre || '—'}{r.clienteWhatsapp ? ` · ${r.clienteWhatsapp}` : ''}</td>
                  <td>{r.fechaInicio || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{formatARS(r.grandTotal || 0)}</td>
                  <td>{estadoBadge(r.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
