import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  signInWithPopup, signInWithCustomToken, signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import {
  fechaCorta, hoyISO,
  CAMPOS_PASAJERO, detectarEncabezados, filasAPasajeros, leerArchivoPlanilla, parsearTexto, apellidoNombre,
} from '../admin/egresados/utils';
import {
  guardarPasajerosMasivo, crearOperativo,
  suscribirAgenciaUsers, crearAgenciaUser,
} from '../firebase/egresadosService';
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
        <div style={{ marginTop: 18, fontSize: 11, color: 'var(--ag-text-3)' }}>
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
        setOperativos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !o.esPrueba));
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
          <OnboardingAgencia sesion={sesion} onOperativoCreado={op => setVista(op)} />
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

// ---- Onboarding para agencia nueva (sin operativos) ----
function OnboardingAgencia({ sesion, onOperativoCreado }) {
  const [tab, setTab] = useState('bienvenida'); // bienvenida | viaje | coordinadores
  const [usuarios, setUsuarios] = useState([]);
  const [modalViaje, setModalViaje] = useState(false);

  useEffect(() => suscribirAgenciaUsers(sesion.agenciaId, setUsuarios, console.error), [sesion.agenciaId]);

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--ag-sep)' }}>
        {[
          { id: 'bienvenida', label: '👋 Bienvenida' },
          { id: 'viaje',      label: '📋 Primer viaje' },
          { id: 'coordinadores', label: '👥 Coordinadores' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`ag-btn ag-btn-ghost${tab === t.id ? ' ag-btn-active' : ''}`}
            style={{
              borderRadius: '8px 8px 0 0', borderBottom: tab === t.id ? '2px solid var(--ag-accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--ag-accent)' : 'var(--ag-text-2)', fontWeight: tab === t.id ? 700 : 400,
              padding: '10px 16px', fontSize: 14,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bienvenida' && (
        <div className="ag-section" style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ag-text)', marginBottom: 8 }}>
            ¡Bienvenidos, {sesion.agenciaNombre || sesion.nombre}!
          </div>
          <p style={{ color: 'var(--ag-text-2)', lineHeight: 1.7, marginBottom: 20 }}>
            Este es el sistema de gestión de viajes de egresados de <strong>Surcante</strong>.
            Desde acá podés ver el estado de cada operativo, gestionar pasajeros, coordinadores e itinerarios.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: '1', title: 'Creás tu primer viaje', desc: 'Completás los datos básicos del viaje (nombre, destino, fechas) e importás los pasajeros desde Excel.' },
              { n: '2', title: 'Sumás coordinadores', desc: 'Invitás a los coordinadores de tu agencia por email. Van a tener acceso al portal en tiempo real.' },
              { n: '3', title: 'Los pasajeros se conectan', desc: 'Cada pasajero recibe un acceso único para ver su lugar, ómnibus y toda la info del viaje.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--ag-card-2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ag-accent)', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--ag-text)', marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ag-text-3)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="ag-btn ag-btn-primary" onClick={() => setTab('viaje')}>Crear mi primer viaje →</button>
            <button className="ag-btn ag-btn-ghost" onClick={() => setTab('coordinadores')}>Gestionar coordinadores</button>
          </div>
        </div>
      )}

      {tab === 'viaje' && (
        <div className="ag-section" style={{ maxWidth: 560 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ag-text)', marginBottom: 4 }}>Crear primer viaje</div>
          <p style={{ fontSize: 13, color: 'var(--ag-text-3)', marginBottom: 20 }}>
            Completá los datos básicos. Después podrás importar pasajeros desde Excel dentro del operativo.
          </p>
          <CrearViajeForm agenciaId={sesion.agenciaId} agenciaNombre={sesion.agenciaNombre} onCreado={onOperativoCreado} />
        </div>
      )}

      {tab === 'coordinadores' && (
        <div className="ag-section" style={{ maxWidth: 560 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ag-text)', marginBottom: 4 }}>Coordinadores de la agencia</div>
          <p style={{ fontSize: 13, color: 'var(--ag-text-3)', marginBottom: 20 }}>
            Los coordinadores pueden acceder al portal de seguimiento en tiempo real.
          </p>
          <GestionCoordinadores agenciaId={sesion.agenciaId} usuarios={usuarios} />
        </div>
      )}
    </div>
  );
}

// ---- Formulario crear primer viaje ----
function CrearViajeForm({ agenciaId, agenciaNombre, onCreado }) {
  const [form, setForm] = useState({ nombre: '', destino: '', fechaInicio: '', fechaFin: '', cantBuses: 1 });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleCrear() {
    if (!form.nombre.trim() || !form.destino.trim() || !form.fechaInicio || !form.fechaFin) {
      setError('Completá nombre, destino y fechas.'); return;
    }
    setGuardando(true); setError('');
    try {
      const buses = Array.from({ length: Math.max(1, Number(form.cantBuses) || 1) }, (_, i) => ({
        nombre: `Bus ${i + 1}`, numero: i + 1,
      }));
      const ref = await crearOperativo({
        nombre: form.nombre.trim(),
        destino: form.destino.trim(),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        agenciaId,
        agenciaNombre: agenciaNombre || '',
        estado: 'planificacion',
      }, buses);
      onCreado({ id: ref.id, nombre: form.nombre.trim(), destino: form.destino.trim(), fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, agenciaId, estado: 'planificacion' });
    } catch (e) {
      console.error(e); setError('No se pudo crear el viaje. Revisá la conexión.');
    }
    setGuardando(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[
        { label: 'Nombre del viaje', key: 'nombre', type: 'text', placeholder: 'ej: Egresados CENS 35 — 2025' },
        { label: 'Destino',          key: 'destino', type: 'text', placeholder: 'ej: Bariloche' },
        { label: 'Fecha de inicio',  key: 'fechaInicio', type: 'date', placeholder: '' },
        { label: 'Fecha de fin',     key: 'fechaFin',    type: 'date', placeholder: '' },
      ].map(f => (
        <div key={f.key}>
          <label className="ag-label">{f.label}</label>
          <input className="ag-input" type={f.type} placeholder={f.placeholder}
            value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
        </div>
      ))}
      <div>
        <label className="ag-label">Cantidad de ómnibus</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="ag-btn ag-btn-ghost ag-btn-sm"
            onClick={() => set('cantBuses', Math.max(1, form.cantBuses - 1))}>−</button>
          <span style={{ fontWeight: 700, fontSize: 18, minWidth: 24, textAlign: 'center', color: 'var(--ag-text)' }}>{form.cantBuses}</span>
          <button className="ag-btn ag-btn-ghost ag-btn-sm"
            onClick={() => set('cantBuses', form.cantBuses + 1)}>+</button>
        </div>
      </div>
      {error && <div className="ag-alert ag-alert-error">{error}</div>}
      <button className="ag-btn ag-btn-primary" onClick={handleCrear} disabled={guardando}>
        {guardando ? 'Creando...' : '✓ Crear viaje y continuar'}
      </button>
    </div>
  );
}

// ---- Gestión de coordinadores ----
function GestionCoordinadores({ agenciaId, usuarios }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function agregar() {
    if (!email.trim() || !nombre.trim()) { setError('Completá nombre y email.'); return; }
    const emailLower = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) { setError('Email no válido.'); return; }
    setGuardando(true); setError(''); setOk('');
    try {
      await crearAgenciaUser(emailLower, agenciaId, nombre.trim());
      setNombre(''); setEmail('');
      setOk(`✓ ${emailLower} agregado correctamente.`);
    } catch (e) {
      console.error(e); setError('No se pudo guardar. Revisá la conexión.');
    }
    setGuardando(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Lista actual */}
      {usuarios.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ag-text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Coordinadores actuales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {usuarios.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ag-card-2)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(var(--ag-accent-rgb),.15)', color: 'var(--ag-accent)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(u.nombre || u.id)[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ag-text)', fontSize: 14 }}>{u.nombre || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ag-text-3)' }}>{u.id}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: u.activa !== false ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.10)', color: u.activa !== false ? '#059669' : '#DC2626', padding: '2px 8px', borderRadius: 20 }}>
                  {u.activa !== false ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agregar nuevo */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ag-text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Agregar coordinador</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="ag-label">Nombre completo</label>
            <input className="ag-input" type="text" placeholder="ej: Ana García" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="ag-label">Email</label>
            <input className="ag-input" type="email" placeholder="ej: ana@miagencia.com" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregar()} />
          </div>
          {error && <div className="ag-alert ag-alert-error">{error}</div>}
          {ok    && <div style={{ background: 'rgba(16,185,129,.10)', color: '#059669', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{ok}</div>}
          <button className="ag-btn ag-btn-primary" onClick={agregar} disabled={guardando}>
            {guardando ? 'Guardando...' : '+ Agregar coordinador'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ag-text-3)', marginTop: 10, lineHeight: 1.5 }}>
          El coordinador podrá ingresar con su cuenta de Google usando este email. Le avisale para que acceda a <strong>surcante.ar/agencia</strong>.
        </p>
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
      s => { setBuses(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) =>
        (a.numero ?? Infinity) - (b.numero ?? Infinity) ||
        (a.nombre || a.codigo || '').localeCompare(b.nombre || b.codigo || '')
      )); done(); },
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
        <div className="ag-topbar-brand">🎓 {op.agenciaNombre || 'Portal de agencias'}</div>
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
            {tab === 'pasajeros' && (
              <TabPasajeros
                pasajeros={pasajeros}
                buses={buses}
                staff={staff}
                opId={op.id}
              />
            )}
            {tab === 'itinerario' && <TabItinerario itinerario={itinerario} />}
          </>
        )}
      </div>
    </div>
  );
}

function busNombre(bus) {
  if (!bus) return '—';
  return bus.nombre || bus.codigo || (bus.numero != null ? `Bus ${bus.numero}` : null) || bus.patente || 'Sin nombre';
}

function TabBuses({ buses, staff, pasajeros }) {
  if (buses.length === 0) {
    return <div className="ag-section" style={{ color: 'var(--ag-text-3)', textAlign: 'center', fontSize: 13 }}>No hay buses cargados.</div>;
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
              🚌 {busNombre(bus)}
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
    return busNombre(buses.find(b => b.id === busId));
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
    return <div className="ag-section" style={{ color: 'var(--ag-text-3)', textAlign: 'center', fontSize: 13 }}>No hay personal cargado.</div>;
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

function TabPasajeros({ pasajeros, buses, staff, opId }) {
  const [busca, setBusca] = useState('');
  const [mostrarImport, setMostrarImport] = useState(false);

  function busLabel(busId) {
    return busNombre(buses.find(b => b.id === busId));
  }

  const filtrados = busca.trim()
    ? pasajeros.filter(p =>
        [p.apellido, p.nombre, p.dni, p.localidad].join(' ').toLowerCase().includes(busca.toLowerCase()))
    : pasajeros;

  return (
    <>
      {mostrarImport && (
        <ImportarPasajerosAgencia
          opId={opId}
          buses={buses}
          staff={staff}
          pasajeros={pasajeros}
          onClose={() => setMostrarImport(false)}
          onListo={n => setMostrarImport(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--ag-text-3)' }}>
          {pasajeros.length === 0 ? 'Sin pasajeros cargados' : `${pasajeros.length} pasajero${pasajeros.length !== 1 ? 's' : ''}`}
        </div>
        <button className="ag-btn ag-btn-primary ag-btn-sm" onClick={() => setMostrarImport(true)}>
          📥 Importar desde Excel
        </button>
      </div>

      {pasajeros.length === 0 ? (
        <div className="ag-section" style={{ color: 'var(--ag-text-3)', textAlign: 'center', fontSize: 13 }}>
          No hay pasajeros cargados. Usá el botón <strong>Importar desde Excel</strong> para cargarlos.
        </div>
      ) : (
        <div className="ag-section" style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: 12 }}>
            <input
              className="ag-input"
              placeholder="🔍 Buscar por apellido, nombre o DNI..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ag-text-3)', marginBottom: 8 }}>
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
                  <td style={{ color: 'var(--ag-text-3)' }}>{i + 1}</td>
                  <td>{p.apellido}, {p.nombre}</td>
                  <td>{p.dni || '—'}</td>
                  <td>{p.busId ? busLabel(p.busId) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---- Importar pasajeros desde Excel (ag-* styles) ----
function ImportarPasajerosAgencia({ opId, buses, staff, pasajeros, onClose, onListo }) {
  const [paso, setPaso] = useState('origen'); // origen | mapeo
  const [libro, setLibro] = useState(null);
  const [hoja, setHoja] = useState('');
  const [filas, setFilas] = useState([]);
  const [idxEnc, setIdxEnc] = useState(0);
  const [mapeo, setMapeo] = useState([]);
  const [texto, setTexto] = useState('');
  const [modoDuplicado, setModoDuplicado] = useState('actualizar');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  function prepararFilas(f) {
    const limpias = f.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''));
    if (limpias.length < 2) {
      setError('No encontramos datos: el archivo necesita una fila de títulos y al menos un pasajero.');
      return;
    }
    const det = detectarEncabezados(limpias);
    setFilas(limpias);
    setIdxEnc(det.idx);
    setMapeo(ajustarLargo(det.mapeo, limpias[det.idx].length));
    setError('');
    setPaso('mapeo');
  }

  async function abrirArchivo(file) {
    if (!file) return;
    setCargando(true);
    setError('');
    try {
      const lb = await leerArchivoPlanilla(file);
      setLibro(lb);
      setHoja(lb.hojas[0]);
      prepararFilas(lb.leer(lb.hojas[0]));
    } catch (e) {
      setError(e.message || 'No se pudo leer el archivo.');
    }
    setCargando(false);
  }

  function cambiarHoja(h) {
    setHoja(h);
    prepararFilas(libro.leer(h));
  }

  function usarTexto() {
    if (!texto.trim()) { setError('Pegá los datos copiados del Excel (incluyendo la fila de títulos).'); return; }
    prepararFilas(parsearTexto(texto));
  }

  function cambiarEncabezado(i) {
    setIdxEnc(i);
    const det = detectarEncabezados([filas[i]]);
    setMapeo(ajustarLargo(det.mapeo, filas[i].length));
  }

  function cambiarMapeo(col, campo) {
    setMapeo(prev => prev.map((m, i) => {
      if (i === col) return campo;
      return campo && m === campo ? '' : m;
    }));
  }

  const nuevos = useMemo(
    () => (paso === 'mapeo' ? filasAPasajeros(filas, idxEnc, mapeo, buses, staff) : []),
    [paso, filas, idxEnc, mapeo, buses, staff],
  );

  const analisis = useMemo(() => {
    const porDni = new Map(pasajeros.filter(p => p.dni).map(p => [p.dni, p]));
    let actualizan = 0; let omitidos = 0; let dupInternos = 0;
    const vistos = new Set();
    const lista = [];
    nuevos.forEach(p => {
      if (p.dni && vistos.has(p.dni)) { dupInternos++; return; }
      if (p.dni) vistos.add(p.dni);
      const existente = p.dni ? porDni.get(p.dni) : null;
      if (existente) {
        if (modoDuplicado === 'omitir') { omitidos++; return; }
        actualizan++;
        lista.push({ ...p, id: existente.id, _existe: true });
      } else {
        lista.push(p);
      }
    });
    const busNoEncontrado = [...new Set(nuevos.filter(p => p._busTexto && !p.busId).map(p => p._busTexto))];
    const sinDni = nuevos.filter(p => !p.dni).length;
    return { lista, actualizan, omitidos, dupInternos, busNoEncontrado, sinDni };
  }, [nuevos, pasajeros, modoDuplicado]);

  async function importar() {
    setCargando(true);
    setError('');
    try {
      const datos = analisis.lista.map(({ _busTexto, _coordTexto, _existe, ...p }) => {
        if (!_existe) return p;
        const limpio = { ...p };
        Object.keys(limpio).forEach(k => { if (k !== 'id' && (limpio[k] === '' || limpio[k] === null)) delete limpio[k]; });
        return limpio;
      });
      await guardarPasajerosMasivo(opId, datos);
      onListo?.(datos.length);
      onClose();
    } catch (e) {
      console.error(e);
      setError('Error guardando. Revisá los datos y volvé a intentar (los DNI ya cargados se actualizan, no se duplican).');
      setCargando(false);
    }
  }

  const tieneNombre = mapeo.some(m => ['apellido', 'nombre', 'apellidoNombre', 'nombreApellido'].includes(m));

  return (
    <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ag-modal">
        <div className="ag-modal-head">
          <div className="ag-modal-title">📥 Importar pasajeros desde Excel</div>
          <button className="ag-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ag-modal-body">

          {paso === 'origen' && (
            <>
              <div
                className={`ag-drop${drag ? ' drag' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); abrirArchivo(e.dataTransfer.files?.[0]); }}
              >
                <div style={{ fontSize: 34 }}>📄</div>
                <div className="ag-drop-title">
                  {cargando ? 'Leyendo archivo...' : 'Arrastrá el Excel o tocá para elegirlo'}
                </div>
                <div>.xlsx · .xls · .csv — detectamos las columnas automáticamente</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv,.ods"
                  style={{ display: 'none' }}
                  onChange={e => { abrirArchivo(e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>

              <div style={{ textAlign: 'center', margin: '14px 0', fontSize: 12, color: 'var(--ag-text-3)', fontWeight: 700 }}>— o pegá las celdas copiadas del Excel —</div>

              <div className="ag-form-row">
                <label className="ag-label">Datos pegados del Excel (con la fila de títulos)</label>
                <textarea
                  className="ag-input"
                  rows={5}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  placeholder={'Apellido\tNombre\tDNI\tColegio\nPérez\tJuan\t45123456\tEsc. N°53'}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </div>
              <button className="ag-btn ag-btn-ghost" style={{ width: '100%' }} onClick={usarTexto}>
                Continuar con el texto pegado →
              </button>
            </>
          )}

          {paso === 'mapeo' && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                {libro?.hojas?.length > 1 && (
                  <div className="ag-form-row" style={{ flex: '1 1 160px', marginBottom: 0 }}>
                    <label className="ag-label">Hoja</label>
                    <select className="ag-input" style={{ padding: '8px 10px', fontSize: 14 }} value={hoja} onChange={e => cambiarHoja(e.target.value)}>
                      {libro.hojas.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                )}
                <div className="ag-form-row" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                  <label className="ag-label">Fila de títulos</label>
                  <select className="ag-input" style={{ padding: '8px 10px', fontSize: 14 }} value={idxEnc} onChange={e => cambiarEncabezado(Number(e.target.value))}>
                    {filas.slice(0, 15).map((f, i) => (
                      <option key={i} value={i}>Fila {i + 1}: {f.filter(Boolean).slice(0, 3).join(' | ').slice(0, 50)}</option>
                    ))}
                  </select>
                </div>
                <div className="ag-form-row" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                  <label className="ag-label">Si el DNI ya existe</label>
                  <select className="ag-input" style={{ padding: '8px 10px', fontSize: 14 }} value={modoDuplicado} onChange={e => setModoDuplicado(e.target.value)}>
                    <option value="actualizar">Actualizar sus datos</option>
                    <option value="omitir">Dejarlo como está</option>
                  </select>
                </div>
              </div>

              <div className="ag-section-title">Columnas detectadas — corregí las que hagan falta</div>
              <div className="ag-map-grid">
                {(filas[idxEnc] || []).map((h, i) => (
                  <div key={i} className={`ag-map-item${mapeo[i] ? ' ok' : ''}`}>
                    <div className="col" title={String(h)}>{String(h || `Col. ${i + 1}`)}</div>
                    <select value={mapeo[i] || ''} onChange={e => cambiarMapeo(i, e.target.value)}>
                      <option value="">— No importar —</option>
                      {CAMPOS_PASAJERO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {!tieneNombre && (
                <div className="ag-alert ag-alert-error" style={{ marginBottom: 10 }}>
                  ⛔ Indicá qué columna tiene el nombre y apellido del pasajero.
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className="ag-chip ag-chip-purple">{nuevos.length} filas leídas</span>
                <span className="ag-chip ag-chip-green">{analisis.lista.length - analisis.actualizan} nuevos</span>
                {analisis.actualizan > 0 && <span className="ag-chip">{analisis.actualizan} se actualizan</span>}
                {analisis.omitidos > 0 && <span className="ag-chip">{analisis.omitidos} se omiten</span>}
                {analisis.dupInternos > 0 && <span className="ag-chip ag-chip-red">{analisis.dupInternos} DNI repetidos</span>}
                {analisis.sinDni > 0 && <span className="ag-chip ag-chip-amber">{analisis.sinDni} sin DNI</span>}
              </div>

              {analisis.busNoEncontrado.length > 0 && (
                <div className="ag-alert ag-alert-info" style={{ marginBottom: 10 }}>
                  ⚠️ Estos ómnibus del Excel no existen en el operativo: <b>{analisis.busNoEncontrado.slice(0, 5).join(', ')}</b>. Esos pasajeros quedan sin asignar.
                </div>
              )}

              <div className="ag-section" style={{ overflowX: 'auto', maxHeight: 220, marginBottom: 0 }}>
                <table className="ag-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>Pasajero</th><th>DNI</th><th>Bus</th></tr>
                  </thead>
                  <tbody>
                    {analisis.lista.slice(0, 10).map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>
                          {apellidoNombre(p)}
                          {p._existe && <span className="ag-chip" style={{ marginLeft: 6, fontSize: 10 }}>actualiza</span>}
                        </td>
                        <td>{p.dni || <span style={{ color: 'var(--ag-text-3)' }}>—</span>}</td>
                        <td>{p.busId ? (buses.find(b => b.id === p.busId)?.nombre || `Bus ${buses.find(b => b.id === p.busId)?.numero}`) : <span style={{ color: 'var(--ag-text-3)' }}>{p._busTexto || '—'}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analisis.lista.length > 10 && (
                  <div style={{ fontSize: 12, color: 'var(--ag-text-3)', padding: '8px 0 0' }}>…y {analisis.lista.length - 10} más.</div>
                )}
              </div>
            </>
          )}

          {error && <div className="ag-alert ag-alert-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        <div className="ag-modal-foot">
          {paso === 'mapeo' ? (
            <>
              <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => { setPaso('origen'); setLibro(null); }}>
                ← Otro archivo
              </button>
              <button
                className="ag-btn ag-btn-primary"
                onClick={importar}
                disabled={cargando || !tieneNombre || !analisis.lista.length}
              >
                {cargando ? 'Importando...' : `✓ Importar ${analisis.lista.length} pasajeros`}
              </button>
            </>
          ) : (
            <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={onClose}>Cancelar</button>
          )}
        </div>
      </div>
    </div>
  );
}

function ajustarLargo(m, largo) {
  const arr = m.slice(0, largo);
  while (arr.length < largo) arr.push('');
  return arr;
}

function TabItinerario({ itinerario }) {
  if (itinerario.length === 0) {
    return <div className="ag-section" style={{ color: 'var(--ag-text-3)', textAlign: 'center', fontSize: 13 }}>No hay itinerario cargado.</div>;
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
          {dia.resumen && <div style={{ fontSize: 13, color: 'var(--ag-text-2)', lineHeight: 1.6 }}>{dia.resumen}</div>}
          {dia.actividades?.length > 0 && (
            <ul style={{ margin: '8px 0 0 14px', fontSize: 12.5, color: 'var(--ag-text-2)', lineHeight: 1.7 }}>
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
  const loginInProgressRef = useRef(false);

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
      } else if (!loginInProgressRef.current) {
        setEstado('login');
      }
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = useCallback(async () => {
    loginInProgressRef.current = true;
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
    } finally {
      loginInProgressRef.current = false;
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
