import React, { useEffect, useMemo, useState } from 'react';
import { suscribirReservas } from '../../firebase/services';
import { formatARS } from '../../utils/calculos';
import { descargarPdfCotizacion, abrirPdfCotizacion } from '../../utils/pdfCotizacion';

// Base de datos de presupuestos día a día.
// Cada cotización guardada en Firestore se puede ver/descargar como PDF al instante.

const TIPO_LABELS = {
  charter: '🚌 Charter',
  receptivo: '🏛️ Receptivo',
  disposicion: '📅 Disposición',
  'movimientos-caba-gba': '🔄 Movimientos',
};

function fechaDe(r) {
  if (r.creadoEn?.toDate) return r.creadoEn.toDate();
  if (r.creadoEn?.seconds) return new Date(r.creadoEn.seconds * 1000);
  return null;
}

function claveDia(d) {
  if (!d) return 'sin-fecha';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // fecha local (Argentina)
}

function labelDia(clave) {
  if (clave === 'sin-fecha') return 'Sin fecha';
  const hoy = claveDia(new Date());
  const ayer = claveDia(new Date(Date.now() - 86400000));
  const d = new Date(clave + 'T12:00:00');
  const texto = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (clave === hoy) return `Hoy · ${texto}`;
  if (clave === ayer) return `Ayer · ${texto}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function Cotizaciones() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todas');

  useEffect(() => {
    const unsub = suscribirReservas(data => { setReservas(data); setLoading(false); });
    return unsub;
  }, []);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = reservas.filter(r => {
      if (filtroTipo !== 'todas' && (r.tipo || 'charter') !== filtroTipo) return false;
      if (!q) return true;
      return [r.clienteNombre, r.clienteWhatsapp, r.nroCotizacion, r.origen, r.destino, r.unidad]
        .some(v => v && String(v).toLowerCase().includes(q));
    });
    const map = new Map();
    filtradas.forEach(r => {
      const k = claveDia(fechaDe(r));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [reservas, busqueda, filtroTipo]);

  if (loading) return <div className="admin-loading">Cargando cotizaciones...</div>;

  const totalHoy = grupos.find(([k]) => k === claveDia(new Date()))?.[1] || [];

  return (
    <div>
      <div className="section-header">
        <div className="section-title">
          Cotizaciones / PDFs ({reservas.length} total · {totalHoy.length} hoy)
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por cliente, N°, WhatsApp, destino..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ flex: '1 1 220px', border: '1.5px solid #EDE8F8', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
        />
        {['todas', 'charter', 'receptivo', 'disposicion', 'movimientos-caba-gba'].map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1.5px solid', borderColor: filtroTipo === t ? '#7B2FBE' : '#EDE8F8',
              background: filtroTipo === t ? '#7B2FBE' : '#fff',
              color: filtroTipo === t ? '#fff' : '#4A4A6A', fontFamily: 'Inter, sans-serif',
            }}>
            {t === 'todas' ? 'Todas' : (TIPO_LABELS[t] || t)}
          </button>
        ))}
      </div>

      {grupos.length === 0 && (
        <div className="admin-empty">
          <div className="admin-empty-icon">📄</div>
          No hay cotizaciones para mostrar
        </div>
      )}

      {grupos.map(([dia, items]) => (
        <div key={dia} style={{ marginBottom: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0A0A0F' }}>{labelDia(dia)}</div>
            <span style={{
              background: '#F4F2FA', color: '#7B2FBE', borderRadius: 999,
              padding: '2px 10px', fontSize: 11, fontWeight: 700,
            }}>
              {items.length} presupuesto{items.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 11, color: '#9090B0', fontWeight: 600 }}>
              {formatARS(items.reduce((s, r) => s + (r.grandTotal || 0), 0))} cotizados
            </span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>N° Cotización</th>
                  <th>Servicio</th>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th style={{ textAlign: 'right' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => {
                  const f = fechaDe(r);
                  return (
                    <tr key={r.id}>
                      <td>{f ? f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td style={{ fontWeight: 700, color: '#7B2FBE' }}>{r.nroCotizacion || ('SRC-' + r.id.slice(-6).toUpperCase())}</td>
                      <td>{TIPO_LABELS[r.tipo] || r.tipo || 'Charter'}</td>
                      <td style={{ fontWeight: 600 }}>{r.clienteNombre || '—'}</td>
                      <td>
                        {r.clienteWhatsapp ? (
                          <a href={`https://wa.me/${String(r.clienteWhatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>
                            {r.clienteWhatsapp}
                          </a>
                        ) : '—'}
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatARS(r.grandTotal || 0)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{r.payMethod || '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => abrirPdfCotizacion(r)} title="Ver PDF"
                          style={{ border: '1.5px solid #EDE8F8', background: '#fff', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12, marginRight: 6 }}>
                          👁️ Ver
                        </button>
                        <button onClick={() => descargarPdfCotizacion(r)} title="Descargar PDF"
                          style={{ border: 'none', background: '#7B2FBE', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          📄 Descargar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
