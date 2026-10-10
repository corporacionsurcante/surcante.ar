import { useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup, signInWithCustomToken, signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { fechaCorta, hoyISO } from '../admin/egresados/utils';
import './agencia.css';

const ESTADOS = {
  planificacion: { label: 'En planificación', cls: 'ag-chip-blue' },
  confirmado:    { label: 'Confirmado', cls: 'ag-chip-amber' },
  en_curso:      { label: 'En curso', cls: 'ag-chip-green' },
  finalizado:    { label: 'Finalizado', cls: '' },
  cancelado:     { label: 'Cancelado', cls: 'ag-chip-red' },
};

function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] || { label: estado, cls: '' };
  return <span className={`ag-chip ${e.cls}`}>{e.label}</span>;
}

// ---- Pantalla login ----
function LoginScreen({ onLoginOk, cargando, error }) {
  return (
    <div className="ag-login-wrap">
      <div className="ag-login-card">
        <div className="ag-login-logo">🎓</div>
        <div className="ag-login-title">Portal de agencias</div>
        <div className="ag-login-sub">
          Ingresá con la cuenta de Google habilitada por Surcante para ver tus operativos.
        </div>
        {error && <div className="ag-alert ag-alert-error" style={{ marginBottom: 14 }}>{error}</div>}
        <button
          className="ag-btn ag-btn-google"
          onClick={onLoginOk}
          disabled={cargando}
        >
          {cargando
            ? <><span className="ag-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Verificando...</>
            : <><GoogleIcon /> Continuar con Google</>
          }
        </button>
        <div style={{ marginTop: 18, fontSize: 11, color: '#B0B0C8' }}>
          surcante.com — Sistema de gestión de egresados
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.4-5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z"/>
      <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 37 26.9 38 24 38c-5.3 0-9.8-3.6-11.4-8.5l-6.5 5C9.7 41.2 16.4 45.5 24 45.5z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.2C41.2 35.2 44 30.5 44 25c0-1.7-.2-3.3-.4-5z"/>
    </svg>
  );
}

// ---- Dashboard principal ----
function Dashboard({ sesion, onLogout }) {
  const [operativos, setOperativos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState(null); // null = lista, objeto = detalle

  useEffect(() => {
    const q = query(
      collection(db, 'operativos'),
      where('agenciaId', '==', sesion.agenciaId),
      orderBy('fechaInicio', 'desc'),
    );
    const unsub = onSnapshot(q,
      snap => {
        setOperativos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      err => {
        console.error(err);
        setError('No se pudieron cargar los operativos. ' + (err?.message || ''));
        setCargando(false);
      },
    );
    return unsub;
  }, [sesion.agenciaId]);

  if (cargando) {
    return (
      <div className="ag-center">
        <div className="ag-spinner" />
        Cargando operativos…
      </div>
    );
  }

  if (vista) {
    return (
      <DetalleOperativo
        operativo={vista}
        agenciaId={sesion.agenciaId}
        onVolver={() => setVista(null)}
      />
    );
  }

  const activos = operativos.filter(o => ['planificacion', 'confirmado', 'en_curso'].includes(o.estado));
  const pasados = operativos.filter(o => ['finalizado', 'cancelado'].includes(o.estado));
  const hoy = hoyISO();

  return (
    <div className="ag-shell">
      <header className="ag-topbar">
        <div className="ag-topbar-brand">🎓 {sesion.agenciaNombre || 'Mi agencia'}</div>
        <div className="ag-topbar-right">
          <span>{sesion.nombre}</span>
          <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </header>
      <div className="ag-body">
        {error && <div className="ag-alert ag-alert-error">{error}</div>}

        <div className="ag-head">
          <div>
            <div className="ag-title">Operativos</div>
            <div className="ag-sub">{operativos.length} en total · {activos.length} activo{activos.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        {operativos.length === 0 ? (
          <div className="ag-section" style={{ textAlign: 'center', color: 'rgba(240,238,255,0.45)', fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚌</div>
            No hay operativos cargados para tu agencia todavía.
          </div>
        ) : (
          <>
            {activos.length > 0 && (
              <>
                <div className="ag-group-label">Activos y próximos</div>
                <div className="ag-grid" style={{ marginBottom: 24 }}>
                  {activos.map(o => (
                    <OperativoCard key={o.id} op={o} hoy={hoy} onClick={() => setVista(o)} />
                  ))}
                </div>
              </>
            )}
            {pasados.length > 0 && (
              <>
                <div className="ag-group-label">Finalizados / cancelados</div>
                <div className="ag-grid">
                  {pasados.map(o => (
                    <OperativoCard key={o.id} op={o} hoy={hoy} onClick={() => setVista(o)} pasado />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OperativoCard({ op, hoy, onClick, pasado }) {
  const diasRestantes = op.fechaInicio
    ? Math.ceil((new Date(op.fechaInicio) - new Date(hoy)) / 86400000)
    : null;

  return (
    <div className="ag-card" onClick={onClick} style={pasado ? { opacity: .75 } : {}}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="ag-card-title">{op.nombre}</div>
        <EstadoBadge estado={op.estado} />
      </div>
      <div className="ag-card-meta">
        {op.destino && <>📍 {op.destino}<br /></>}
        📅 {fechaCorta(op.fechaInicio)} → {fechaCorta(op.fechaFin)}
        {op.salida?.lugar && <><br />🚏 Sale de {op.salida.lugar}{op.salida.hora ? ` · ${op.salida.hora} h` : ''}</>}
      </div>
      <div className="ag-card-foot">
        {op.busesCount > 0 && (
          <span className="ag-chip">🚌 {op.busesCount} {op.busesCount === 1 ? 'bus' : 'buses'}</span>
        )}
        {diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 90 && (
          <span className="ag-chip ag-chip-amber">En {diasRestantes} día{diasRestantes === 1 ? '' : 's'}</span>
        )}
        {op.estado === 'en_curso' && (
          <span className="ag-chip ag-chip-green">🟢 En curso</span>
        )}
      </div>
    </div>
  );
}

// ---- Detalle de operativo ----
function DetalleOperativo({ operativo: op, agenciaId, onVolver }) {
  const [tab, setTab] = useState('buses');
  const [buses, setBuses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pasajeros, setPasajeros] = useState([]);
  const [itinerario, setItinerario] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let pendientes = 4;
    const done = () => { pendientes--; if (pendientes === 0) setCargando(false); };

    const q1 = onSnapshot(collection(db, 'operativos', op.id, 'buses'),
      s => { setBuses(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.numero - b.numero || a.nombre?.localeCompare(b.nombre))); done(); },
      () => done());
    const q2 = onSnapshot(collection(db, 'operativos', op.id, 'staff'),
      s => { setStaff(s.docs.map(d => ({ id: d.id, ...d.data() }))); done(); },
      () => done());
    const q3 = onSnapshot(query(collection(db, 'operativos', op.id, 'pasajeros'), orderBy('apellido')),
      s => { setPasajeros(s.docs.map(d => ({ id: d.id, ...d.data() }))); done(); },
      () => done());
    const q4 = onSnapshot(query(collection(db, 'operativos', op.id, 'itinerario'), orderBy('__name__')),
      s => { setItinerario(s.docs.map(d => ({ id: d.id, ...d.data() }))); done(); },
      () => done());

    return () => { q1(); q2(); q3(); q4(); };
  }, [op.id]);

  const conductores = staff.filter(s => s.rol === 'conductor');
  const coordinadores = staff.filter(s => s.rol === 'coordinador');

  return (
    <div className="ag-shell">
      <header className="ag-topbar">
        <div className="ag-topbar-brand">🎓 Portal de agencias</div>
        <div className="ag-topbar-right">
          <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={onVolver}>← Volver</button>
        </div>
      </header>
      <div className="ag-body">
        <div className="ag-back">
          <button onClick={onVolver}>Operativos</button>
          <span>›</span>
          <span>{op.nombre}</span>
        </div>

        <div className="ag-head" style={{ marginBottom: 14 }}>
          <div>
            <div className="ag-title">{op.nombre}</div>
            <div className="ag-sub">
              {op.destino && `${op.destino} · `}
              {fechaCorta(op.fechaInicio)} → {fechaCorta(op.fechaFin)}
            </div>
          </div>
          <EstadoBadge estado={op.estado} />
        </div>

        {/* Tabs */}
        <div className="ag-tabs-wrap">
          {[
            { id: 'buses', label: `🚌 Buses (${buses.length})` },
            { id: 'personal', label: `👤 Personal (${staff.length})` },
            { id: 'pasajeros', label: `🎒 Pasajeros (${pasajeros.length})` },
            { id: 'itinerario', label: `📅 Itinerario (${itinerario.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`ag-tab${tab === t.id ? ' ag-tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div className="ag-spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <>
            {tab === 'buses' && <TabBuses buses={buses} staff={staff} pasajeros={pasajeros} />}
            {tab === 'personal' && <TabPersonal conductores={conductores} coordinadores={coordinadores} buses={buses} />}
            {tab === 'pasajeros' && <TabPasajeros pasajeros={pasajeros} buses={buses} />}
            {tab === 'itinerario' && <TabItinerario itinerario={itinerario} />}
          </>
        )}
      </div>
    </div>
  );
}

function TabBuses({ buses, staff, pasajeros }) {
  if (buses.length === 0) {
    return <div className="ag-section" style={{ color: 'rgba(240,238,255,0.45)', textAlign: 'center', fontSize: 13 }}>No hay buses cargados.</div>;
  }
  return (
    <div className="ag-grid">
      {buses.map(bus => {
        const paxCount = pasajeros.filter(p => p.busId === bus.id).length;
        const conductor = staff.find(s => s.rol === 'conductor' && s.busId === bus.id);
        const coordinador = staff.find(s => s.rol === 'coordinador' && s.busId === bus.id);
        return (
          <div key={bus.id} className="ag-section">
            <div className="ag-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              🚌 {bus.nombre || `Bus ${bus.numero}`}
              {bus.patente && <span className="ag-chip">{bus.patente}</span>}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ag-text-2)', lineHeight: 1.7 }}>
              {bus.capacidad && <div>💺 {paxCount} / {bus.capacidad} pasajeros</div>}
              {!bus.capacidad && paxCount > 0 && <div>🎒 {paxCount} pasajeros</div>}
              {conductor && <div>🧑‍✈️ Conductor: {conductor.apellido} {conductor.nombre}</div>}
              {coordinador && <div>📋 Coordinador: {coordinador.apellido} {coordinador.nombre}</div>}
              {bus.modelo && <div>🚍 {bus.modelo}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabPersonal({ conductores, coordinadores, buses }) {
  function busLabel(busId) {
    const b = buses.find(b => b.id === busId);
    return b ? (b.nombre || `Bus ${b.numero}`) : '—';
  }
  function filaPersona(p, rol) {
    return (
      <tr key={p.id}>
        <td>{p.apellido}, {p.nombre}</td>
        <td><span className={`ag-chip ${rol === 'conductor' ? 'ag-chip-blue' : 'ag-chip-amber'}`}>{rol === 'conductor' ? 'Conductor' : 'Coordinador'}</span></td>
        <td>{p.busId ? busLabel(p.busId) : '—'}</td>
        <td>{p.telefono || '—'}</td>
      </tr>
    );
  }
  const todos = [
    ...conductores.map(p => ({ ...p, _rol: 'conductor' })),
    ...coordinadores.map(p => ({ ...p, _rol: 'coordinador' })),
  ].sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''));

  if (todos.length === 0) {
    return <div className="ag-section" style={{ color: 'rgba(240,238,255,0.45)', textAlign: 'center', fontSize: 13 }}>No hay personal cargado.</div>;
  }
  return (
    <div className="ag-section" style={{ overflowX: 'auto' }}>
      <table className="ag-table">
        <thead>
          <tr>
            <th>Apellido y nombre</th>
            <th>Rol</th>
            <th>Bus</th>
            <th>Teléfono</th>
          </tr>
        </thead>
        <tbody>{todos.map(p => filaPersona(p, p._rol))}</tbody>
      </table>
    </div>
  );
}

function TabPasajeros({ pasajeros, buses }) {
  const [busca, setBusca] = useState('');

  function busLabel(busId) {
    const b = buses.find(b => b.id === busId);
    return b ? (b.nombre || `Bus ${b.numero}`) : '—';
  }

  const filtrados = busca.trim()
    ? pasajeros.filter(p =>
        [p.apellido, p.nombre, p.dni, p.localidad].join(' ').toLowerCase().includes(busca.toLowerCase()))
    : pasajeros;

  if (pasajeros.length === 0) {
    return <div className="ag-section" style={{ color: 'rgba(240,238,255,0.45)', textAlign: 'center', fontSize: 13 }}>No hay pasajeros cargados.</div>;
  }

  return (
    <div className="ag-section" style={{ overflowX: 'auto' }}>
      <div style={{ marginBottom: 12 }}>
        <input
          className="ag-input"
          placeholder="🔍 Buscar por apellido, nombre o DNI..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>
      <div style={{ fontSize: 12, color: 'rgba(240,238,255,0.45)', marginBottom: 8 }}>
        Mostrando {filtrados.length} de {pasajeros.length} pasajeros
      </div>
      <table className="ag-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Apellido y nombre</th>
            <th>DNI</th>
            <th>Bus</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((p, i) => (
            <tr key={p.id}>
              <td style={{ color: 'rgba(240,238,255,0.45)' }}>{i + 1}</td>
              <td>{p.apellido}, {p.nombre}</td>
              <td>{p.dni || '—'}</td>
              <td>{p.busId ? busLabel(p.busId) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabItinerario({ itinerario }) {
  if (itinerario.length === 0) {
    return <div className="ag-section" style={{ color: 'rgba(240,238,255,0.45)', textAlign: 'center', fontSize: 13 }}>No hay itinerario cargado.</div>;
  }
  const hoy = hoyISO();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {itinerario.map(dia => (
        <div
          key={dia.id}
          className="ag-section"
          style={dia.id === hoy ? { boxShadow: '0 0 0 2px var(--ag-accent), var(--ag-shadow-card)' } : {}}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{formatFechaDia(dia.id)}</div>
            {dia.id === hoy && <span className="ag-chip ag-chip-green">Hoy</span>}
          </div>
          {dia.resumen && <div style={{ fontSize: 13, color: '#3A3A5A', lineHeight: 1.6 }}>{dia.resumen}</div>}
          {dia.actividades?.length > 0 && (
            <ul style={{ margin: '8px 0 0 14px', fontSize: 12.5, color: '#5A5A7A', lineHeight: 1.7 }}>
              {dia.actividades.map((a, i) => <li key={i}>{a.hora ? `${a.hora} — ` : ''}{a.texto}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function formatFechaDia(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fecha = new Date(Number(y), Number(m) - 1, Number(d));
  return `${dias[fecha.getDay()]} ${Number(d)} de ${meses[Number(m) - 1]} de ${y}`;
}

// ---- Componente raíz ----
export default function AgenciaPortal() {
  const [sesion, setSesion] = useState(null);
  const [estado, setEstado] = useState('init'); // init | login | cargando | ok | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user && user.uid.startsWith('agencia_')) {
        user.getIdTokenResult().then(result => {
          const claims = result.claims;
          if (claims.rol === 'agencia' && claims.agenciaId) {
            setSesion({
              uid: user.uid,
              agenciaId: claims.agenciaId,
              nombre: claims.nombre || '',
              agenciaNombre: claims.agenciaNombre || '',
            });
            setEstado('ok');
          } else {
            signOut(auth).catch(() => {});
            setEstado('login');
          }
        }).catch(() => setEstado('login'));
      } else if (estado === 'init') {
        setEstado('login');
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback(async () => {
    setEstado('cargando');
    setErrorMsg('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const resp = await fetch('/api/agencia-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      await signOut(auth);
      await signInWithCustomToken(auth, data.customToken);

      setSesion({
        uid: `agencia_${result.user.email?.replace(/[^a-z0-9]/gi, '_')}`,
        agenciaId: data.agenciaId,
        nombre: data.nombre || result.user.displayName || '',
        agenciaNombre: data.agenciaNombre || '',
      });
      setEstado('ok');
    } catch (e) {
      console.error(e);
      try { await signOut(auth); } catch (_) { /* noop */ }
      setErrorMsg(e.message || 'No se pudo iniciar sesión.');
      setEstado('login');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut(auth).catch(() => {});
    setSesion(null);
    setEstado('login');
    setErrorMsg('');
  }, []);

  if (estado === 'init') {
    return (
      <div className="ag-center">
        <div className="ag-spinner" />
        Cargando…
      </div>
    );
  }

  if (estado === 'login' || estado === 'cargando') {
    return (
      <LoginScreen
        onLoginOk={handleLogin}
        cargando={estado === 'cargando'}
        error={errorMsg}
      />
    );
  }

  if (estado === 'ok' && sesion) {
    return <Dashboard sesion={sesion} onLogout={handleLogout} />;
  }

  return (
    <div className="ag-center">
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div>Estado inesperado. <button className="ag-btn ag-btn-primary" onClick={() => setEstado('login')}>Volver al inicio</button></div>
    </div>
  );
}
