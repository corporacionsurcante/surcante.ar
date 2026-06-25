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

  useEffect(() => {
    const unsub = suscribirReservas(data => { setReservas(data); setLoading(false); });
    return unsub;
  }, []);

  const hoy = new Date().toDateString();
  const reservasHoy = reservas.filter(r => r.creadoEn?.toDate?.()?.toDateString() === hoy);
  const totalMes = reservas.filter(r => {
    const d = r.creadoEn?.toDate?.();
    const ahora = new Date();
    return d && d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  });
  const ingresosMes = totalMes.reduce((acc, r) => acc + (r.sena || 0), 0);
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
          <div className="metric-sub">Señas recibidas</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Reservas activas</div>
          <div className="metric-val purple">{reservasActivas.length}</div>
          <div className="metric-sub">Total histórico</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Por confirmar</div>
          <div className="metric-val" style={{ color: pendientesConfirmar.length > 0 ? '#E8A000' : '#00C896' }}>
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
                <th>Origen → Destino</th>
                <th>Fecha salida</th>
                <th>Unidades</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', color: '#7B2FBE', fontWeight: 700 }}>SRC-{r.id.slice(-6).toUpperCase()}</td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, marginRight: 6,
                      background: r.tipo === 'receptivo' ? '#EDE9FB' : r.tipo === 'disposicion' ? '#FFF8E6' : r.tipo === 'movimientos-caba-gba' ? '#E6FBF5' : '#F4F2FA',
                      color: r.tipo === 'receptivo' ? '#4A0FA8' : r.tipo === 'disposicion' ? '#7A5200' : r.tipo === 'movimientos-caba-gba' ? '#007A5A' : '#4A4A6A',
                    }}>
                      {r.tipo === 'receptivo' ? '🏛️ Receptivo' : r.tipo === 'disposicion' ? '⏱️ Disposición' : r.tipo === 'movimientos-caba-gba' ? '🚐 Mov. CABA/GBA' : '🚌 Charter'}
                    </span>
                    {r.origen ? `${r.origen} → ${r.destino}` : r.descripcion || r.unidad || '—'}
                  </td>
                  <td>{r.fechaInicio || '—'}</td>
                  <td>{r.flotaUnidades?.length || 1} unidad{r.flotaUnidades?.length !== 1 ? 'es' : ''}</td>
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
