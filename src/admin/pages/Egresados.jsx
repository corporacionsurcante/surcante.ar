import React, { useEffect, useMemo, useState } from 'react';
import {
  suscribirAgencias, suscribirTodosOperativos, eliminarAgencia,
  suscribirAgenciaUsers, crearAgenciaUser, actualizarAgenciaUser, eliminarAgenciaUser,
} from '../../firebase/egresadosService';
import AgenciaForm from '../egresados/AgenciaForm';
import OperativoForm from '../egresados/OperativoForm';
import OperativoDetalle from '../egresados/OperativoDetalle';
import { EstadoBadge, Vacio, BotonEliminar, AvisoPermisos } from '../egresados/ui';
import { fechaCorta, normalizarTexto, linkWhatsApp } from '../egresados/utils';
import '../egresados/egresados.css';

// Navegación interna: agencias → agencia → operativo (se recuerda al recargar)
const NAV_KEY = 'surcante_egresados_nav';

function leerNav() {
  try { return JSON.parse(window.sessionStorage.getItem(NAV_KEY)) || { nivel: 'agencias' }; } catch (_) { return { nivel: 'agencias' }; }
}

export default function Egresados() {
  const [nav, setNavState] = useState(leerNav);
  const [agencias, setAgencias] = useState([]);
  const [operativos, setOperativos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorPermisos, setErrorPermisos] = useState('');

  useEffect(() => {
    const onError = e => { console.error(e); setErrorPermisos(e?.code || e?.message || 'error'); setCargando(false); };
    const u1 = suscribirAgencias(a => { setAgencias(a); setCargando(false); }, onError);
    const u2 = suscribirTodosOperativos(setOperativos, onError);
    return () => { u1(); u2(); };
  }, []);

  function setNav(n) {
    setNavState(n);
    try { window.sessionStorage.setItem(NAV_KEY, JSON.stringify(n)); } catch (_) { /* noop */ }
    window.scrollTo({ top: 0 });
  }

  const agencia = agencias.find(a => a.id === nav.agenciaId);

  if (cargando) return <div className="admin-loading">Cargando agencias...</div>;
  if (errorPermisos) return <div className="eg-wrap"><AvisoPermisos codigo={errorPermisos} /></div>;

  if (nav.nivel === 'operativo' && nav.opId) {
    return (
      <div className="eg-wrap">
        <OperativoDetalle
          opId={nav.opId}
          agencia={agencia}
          onVolverAgencias={() => setNav({ nivel: 'agencias' })}
          onVolverAgencia={() => setNav({ nivel: 'agencia', agenciaId: nav.agenciaId })}
          onEliminado={() => setNav({ nivel: 'agencia', agenciaId: nav.agenciaId })}
        />
      </div>
    );
  }

  if (nav.nivel === 'agencia' && agencia) {
    return (
      <div className="eg-wrap">
        <AgenciaDetalle
          agencia={agencia}
          operativos={operativos.filter(o => o.agenciaId === agencia.id)}
          onVolver={() => setNav({ nivel: 'agencias' })}
          onAbrirOperativo={opId => setNav({ nivel: 'operativo', agenciaId: agencia.id, opId })}
        />
      </div>
    );
  }

  return (
    <div className="eg-wrap">
      <AgenciasLista
        agencias={agencias}
        operativos={operativos}
        onAbrir={id => setNav({ nivel: 'agencia', agenciaId: id })}
      />
    </div>
  );
}

// ---------------- Lista de agencias ----------------
function AgenciasLista({ agencias, operativos, onAbrir }) {
  const [modal, setModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const statsPorAgencia = useMemo(() => {
    const m = {};
    operativos.forEach(o => {
      if (!m[o.agenciaId]) m[o.agenciaId] = { total: 0, activos: 0, proximo: null };
      const s = m[o.agenciaId];
      s.total++;
      if (['planificacion', 'confirmado', 'en_curso'].includes(o.estado)) {
        s.activos++;
        if (o.fechaInicio && (!s.proximo || o.fechaInicio < s.proximo)) s.proximo = o.fechaInicio;
      }
    });
    return m;
  }, [operativos]);

  const filtradas = agencias.filter(a => {
    const q = normalizarTexto(busqueda);
    if (!q) return true;
    return normalizarTexto([a.nombre, a.razonSocial, a.contactoNombre, a.localidad, a.cuit].join(' ')).includes(q);
  });

  const enCurso = operativos.filter(o => o.estado === 'en_curso');

  return (
    <>
      <div className="eg-head">
        <div>
          <div className="eg-title">🎓 Agencias de egresados</div>
          <div className="eg-sub">Clientes, operativos, ómnibus, personal, pasajeros y diagrama día a día.</div>
        </div>
        <div className="eg-actions">
          <button className="eg-btn eg-btn-primary" onClick={() => setModal(true)}>+ Nueva agencia</button>
        </div>
      </div>

      {enCurso.length > 0 && (
        <div className="eg-section" style={{ borderColor: '#B7EBD9' }}>
          <div className="eg-section-title">🟢 Operativos en curso</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {enCurso.map(o => (
              <span key={o.id} className="eg-chip eg-chip-green" style={{ cursor: 'pointer' }} onClick={() => onAbrir(o.agenciaId)}>
                {agencias.find(a => a.id === o.agenciaId)?.nombre || o.agenciaNombre} · {o.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {agencias.length > 0 && (
        <div className="eg-toolbar">
          <input className="eg-input" placeholder="🔍 Buscar agencia, contacto, localidad..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
      )}

      {agencias.length === 0 ? (
        <div className="eg-section">
          <Vacio icono="🎓">
            Todavía no hay agencias cargadas.<br />
            <button className="eg-btn eg-btn-primary" style={{ marginTop: 14 }} onClick={() => setModal(true)}>+ Cargar la primera agencia</button>
          </Vacio>
        </div>
      ) : (
        <div className="eg-grid">
          {filtradas.map(a => {
            const s = statsPorAgencia[a.id] || { total: 0, activos: 0 };
            return (
              <div key={a.id} className="eg-card eg-card-click" onClick={() => onAbrir(a.id)}>
                <div className="eg-card-title">{a.nombre}</div>
                <div className="eg-card-meta">
                  {a.contactoNombre && <>👤 {a.contactoNombre}<br /></>}
                  {a.telefono && <>📱 {a.telefono}<br /></>}
                  {(a.localidad || a.provincia) && <>📍 {[a.localidad, a.provincia].filter(Boolean).join(', ')}</>}
                </div>
                <div className="eg-card-foot">
                  <span className="eg-chip eg-chip-purple">{s.total} operativo{s.total === 1 ? '' : 's'}</span>
                  {s.activos > 0 && <span className="eg-chip eg-chip-green">{s.activos} activo{s.activos === 1 ? '' : 's'}</span>}
                  {s.proximo && <span className="eg-chip">Próx. {fechaCorta(s.proximo)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <AgenciaForm onClose={() => setModal(false)} onGuardada={id => onAbrir(id)} />}
    </>
  );
}

// ---------------- Detalle de agencia ----------------
function AgenciaDetalle({ agencia, operativos, onVolver, onAbrirOperativo }) {
  const [editar, setEditar] = useState(false);
  const [nuevoOp, setNuevoOp] = useState(false);
  const [tab, setTab] = useState('operativos');
  const [error, setError] = useState('');

  const ordenados = [...operativos].sort((a, b) => String(b.fechaInicio || '').localeCompare(String(a.fechaInicio || '')));

  async function borrarAgencia() {
    if (operativos.length > 0) { setError('Primero eliminá los operativos de esta agencia.'); return; }
    await eliminarAgencia(agencia.id);
    onVolver();
  }

  return (
    <>
      <div className="eg-breadcrumb">
        <button onClick={onVolver}>Agencias</button> <span>›</span> <span>{agencia.nombre}</span>
      </div>

      <div className="eg-head">
        <div>
          <div className="eg-title">{agencia.nombre}</div>
          <div className="eg-sub">
            {[agencia.razonSocial, agencia.cuit && `CUIT ${agencia.cuit}`, agencia.legajoEVT && `Legajo EVT ${agencia.legajoEVT}`].filter(Boolean).join(' · ') || 'Agencia de turismo estudiantil'}
          </div>
        </div>
        <div className="eg-actions">
          <button className="eg-btn eg-btn-ghost" onClick={() => setEditar(true)}>✏️ Editar agencia</button>
          <button className="eg-btn eg-btn-primary" onClick={() => setNuevoOp(true)}>+ Nuevo operativo</button>
        </div>
      </div>

      <div className="eg-section">
        <div className="eg-section-title">Contacto</div>
        <div className="eg-form-grid" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div><span className="eg-chip">👤</span> {agencia.contactoNombre || '—'}</div>
          <div>
            <span className="eg-chip">📱</span> {agencia.telefono || '—'}
            {agencia.telefono && (
              <a className="eg-btn eg-btn-green eg-btn-sm" style={{ marginLeft: 8 }} href={linkWhatsApp(agencia.telefono, `Hola ${agencia.contactoNombre || ''}!`)} target="_blank" rel="noreferrer">WhatsApp</a>
            )}
          </div>
          <div><span className="eg-chip">✉️</span> {agencia.email || '—'}</div>
          <div><span className="eg-chip">📍</span> {[agencia.direccion, agencia.localidad, agencia.provincia].filter(Boolean).join(', ') || '—'}</div>
          {agencia.notas && <div className="full" style={{ color: '#7A7A96' }}>📝 {agencia.notas}</div>}
        </div>
      </div>

      {/* Tabs: Operativos / Usuarios */}
      <div className="eg-tabs" style={{ marginBottom: 16 }}>
        {[
          { id: 'operativos', label: `🚌 Operativos (${operativos.length})` },
          { id: 'usuarios', label: '👥 Usuarios del portal' },
        ].map(t => (
          <button
            key={t.id}
            className={`eg-tab${tab === t.id ? ' eg-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'operativos' && (
        <>
          {ordenados.length === 0 ? (
            <div className="eg-section">
              <Vacio icono="🚌">
                Esta agencia no tiene operativos todavía.<br />
                <button className="eg-btn eg-btn-primary" style={{ marginTop: 14 }} onClick={() => setNuevoOp(true)}>+ Crear operativo</button>
              </Vacio>
            </div>
          ) : (
            <div className="eg-grid">
              {ordenados.map(o => (
                <div key={o.id} className="eg-card eg-card-click" onClick={() => onAbrirOperativo(o.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div className="eg-card-title">{o.nombre}</div>
                    <EstadoBadge estado={o.estado} />
                  </div>
                  <div className="eg-card-meta">
                    {o.destino && <>📍 {o.destino}<br /></>}
                    📅 {fechaCorta(o.fechaInicio)} → {fechaCorta(o.fechaFin)}
                    {o.salida?.lugar && <><br />🚏 Sale de {o.salida.lugar}{o.salida.hora ? ` · ${o.salida.hora} h` : ''}</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'usuarios' && (
        <AgenciaUsuarios agenciaId={agencia.id} />
      )}

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <BotonEliminar texto="Eliminar agencia" confirmar="Sí, eliminar agencia" onConfirm={borrarAgencia} small />
        {error && <div className="eg-alert eg-alert-error">{error}</div>}
      </div>

      {editar && <AgenciaForm agencia={agencia} onClose={() => setEditar(false)} />}
      {nuevoOp && <OperativoForm agencia={agencia} onClose={() => setNuevoOp(false)} onCreado={onAbrirOperativo} />}
    </>
  );
}

// ---------------- Gestión de usuarios de agencia ----------------
function AgenciaUsuarios({ agenciaId }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const unsub = suscribirAgenciaUsers(
      agenciaId,
      lista => { setUsuarios(lista); setCargando(false); },
      err => { console.error(err); setCargando(false); },
    );
    return unsub;
  }, [agenciaId]);

  async function agregarUsuario(e) {
    e.preventDefault();
    const email = nuevoEmail.trim().toLowerCase();
    const nombre = nuevoNombre.trim();
    if (!email.includes('@')) { setError('Email inválido.'); return; }
    if (nombre.length < 3) { setError('Ingresá un nombre.'); return; }
    setError('');
    setGuardando(true);
    try {
      await crearAgenciaUser(email, agenciaId, nombre);
      setOk(`✅ ${email} agregado.`);
      setNuevoEmail('');
      setNuevoNombre('');
      setMostrarForm(false);
      setTimeout(() => setOk(''), 4000);
    } catch (err) {
      setError(err.message || 'No se pudo agregar el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(u) {
    try {
      await actualizarAgenciaUser(u.id, { activa: !u.activa });
    } catch (err) {
      setError(err.message || 'No se pudo actualizar.');
    }
  }

  async function borrarUsuario(u) {
    if (!window.confirm(`¿Eliminar el acceso de ${u.id}?`)) return;
    try {
      await eliminarAgenciaUser(u.id);
    } catch (err) {
      setError(err.message || 'No se pudo eliminar.');
    }
  }

  if (cargando) return <div style={{ color: '#9090B0', fontSize: 13 }}>Cargando usuarios...</div>;

  return (
    <div className="eg-section">
      <div className="eg-section-title">
        Usuarios del portal de agencia
        <button className="eg-btn eg-btn-primary eg-btn-sm" onClick={() => { setMostrarForm(v => !v); setError(''); }}>
          {mostrarForm ? 'Cancelar' : '+ Agregar usuario'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#9090B0', marginBottom: 14, lineHeight: 1.55 }}>
        Los usuarios aquí listados pueden ingresar a <strong>surcante.com/agencia</strong> con su cuenta de Google para ver los operativos de esta agencia.
      </div>

      {ok && <div className="eg-alert eg-alert-ok" style={{ background: '#E6FBF5', color: '#007A5A', border: '1px solid #B7EBD9', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>{ok}</div>}
      {error && <div className="eg-alert eg-alert-error">{error}</div>}

      {mostrarForm && (
        <form onSubmit={agregarUsuario} style={{ background: '#F8F6FE', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div className="eg-label">Email de Google</div>
              <input
                className="eg-input"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={nuevoEmail}
                onChange={e => setNuevoEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="eg-label">Nombre y apellido</div>
              <input
                className="eg-input"
                type="text"
                placeholder="ej: María López"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="eg-btn eg-btn-primary" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Agregar usuario'}
          </button>
        </form>
      )}

      {usuarios.length === 0 ? (
        <div style={{ color: '#9090B0', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
          No hay usuarios configurados. Agregá uno para que la agencia pueda ver sus operativos.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9090B0', padding: '0 6px 8px 0' }}>Email</th>
              <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9090B0', padding: '0 6px 8px' }}>Nombre</th>
              <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9090B0', padding: '0 6px 8px' }}>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid #F4F2FA' }}>
                <td style={{ padding: '8px 6px 8px 0', fontFamily: 'monospace', fontSize: 12 }}>{u.id}</td>
                <td style={{ padding: '8px 6px' }}>{u.nombre || '—'}</td>
                <td style={{ padding: '8px 6px' }}>
                  <span className={`eg-chip ${u.activa ? 'eg-chip-green' : 'eg-chip-red'}`}>
                    {u.activa ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td style={{ padding: '8px 0', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    className="eg-btn eg-btn-ghost eg-btn-sm"
                    onClick={() => toggleActivo(u)}
                    title={u.activa ? 'Desactivar acceso' : 'Reactivar acceso'}
                  >
                    {u.activa ? '🔒 Desactivar' : '🔓 Reactivar'}
                  </button>
                  <button className="eg-btn eg-btn-danger eg-btn-sm" onClick={() => borrarUsuario(u)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
