import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  signInWithPopup, signInWithCustomToken, signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot, doc, getDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import {
  fechaCorta, hoyISO, rangoFechas, labelFecha, generarToken,
  CAMPOS_PASAJERO, detectarEncabezados, filasAPasajeros, leerArchivoPlanilla, parsearTexto, apellidoNombre,
} from '../admin/egresados/utils';
import {
  guardarPasajerosMasivo, crearOperativo, importarMaestro, crearEnSub,
  actualizarEnSub, eliminarStaff, eliminarPasajerosMasivo,
  generarAccesos, actualizarOperativo, guardarEnSub, eliminarEnSub,
  crearNotificacionOperativo,
} from '../firebase/egresadosService';
import { parsearExcelMaestro } from '../admin/egresados/ImportarMaestro';
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
function LoginScreen({ onLoginOk, onLoginCodigo, cargando, error }) {
  const [modo, setModo] = useState('google');
  const [codigoInput, setCodigoInput] = useState('');

  function handleSubmitCodigo(e) {
    e.preventDefault();
    const limpio = codigoInput.replace(/[-\s]/g, '');
    if (limpio.length >= 4) onLoginCodigo(codigoInput);
  }

  function formatCodigo(val) {
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
  }

  return (
    <div className="ag-login-wrap">
      <div className="ag-login-card">
        <div className="ag-login-logo">🎓</div>
        <div className="ag-login-title">Portal de agencias</div>

        {modo === 'google' && (
          <>
            <div className="ag-login-sub">
              Ingresá con la cuenta de Google habilitada por Surcante para ver tus operativos.
            </div>
            {error && <div className="ag-alert ag-alert-error" style={{ marginBottom: 14 }}>{error}</div>}
            <button className="ag-btn ag-btn-google" onClick={onLoginOk} disabled={cargando}>
              {cargando
                ? <><span className="ag-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Verificando...</>
                : <><GoogleIcon /> Continuar con Google</>}
            </button>
            <button
              className="ag-btn ag-btn-ghost"
              style={{ marginTop: 10, width: '100%', fontSize: 13 }}
              onClick={() => { setModo('codigo'); }}
              disabled={cargando}
            >
              🔑 Tengo un código de acceso
            </button>
          </>
        )}

        {modo === 'codigo' && (
          <>
            <div className="ag-login-sub">
              Ingresá el código de 8 caracteres que te envió Surcante.
            </div>
            {error && <div className="ag-alert ag-alert-error" style={{ marginBottom: 14 }}>{error}</div>}
            <form onSubmit={handleSubmitCodigo} style={{ width: '100%' }}>
              <input
                type="text"
                placeholder="XXXX-XXXX"
                value={codigoInput}
                onChange={e => setCodigoInput(formatCodigo(e.target.value))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  textAlign: 'center', letterSpacing: 6, fontSize: 24, fontFamily: 'monospace',
                  padding: '12px 16px', marginBottom: 12, borderRadius: 10,
                  border: '1.5px solid var(--ag-sep)', background: 'var(--ag-bg-2)',
                  color: 'var(--ag-text-1)', outline: 'none',
                }}
                autoFocus
                autoComplete="off"
                disabled={cargando}
              />
              <button
                type="submit"
                className="ag-btn ag-btn-primary"
                style={{ width: '100%' }}
                disabled={cargando || codigoInput.replace(/[-\s]/g, '').length < 8}
              >
                {cargando
                  ? <><span className="ag-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Verificando...</>
                  : '→ Ingresar con código'}
              </button>
            </form>
            <button
              className="ag-btn ag-btn-ghost"
              style={{ marginTop: 10, width: '100%', fontSize: 13 }}
              onClick={() => { setModo('google'); setCodigoInput(''); }}
              disabled={cargando}
            >
              ← Ingresar con Google
            </button>
          </>
        )}

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
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [cupoMaxBuses, setCupoMaxBuses] = useState(null); // null = sin límite

  useEffect(() => {
    getDoc(doc(db, 'agencias', sesion.agenciaId))
      .then(d => {
        if (d.exists()) {
          const cupo = Number(d.data().cupoMaxBuses);
          setCupoMaxBuses(cupo > 0 ? cupo : null);
        }
      })
      .catch(() => {});
  }, [sesion.agenciaId]);

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
      {mostrarNuevo && (
        <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && setMostrarNuevo(false)}>
          <div className="ag-modal">
            <div className="ag-modal-head">
              <div className="ag-modal-title">Nuevo operativo</div>
              <button className="ag-modal-close" onClick={() => setMostrarNuevo(false)}>✕</button>
            </div>
            <div className="ag-modal-body">
              <CrearViajeForm
                agenciaId={sesion.agenciaId}
                agenciaNombre={sesion.agenciaNombre}
                cupoMaxBuses={cupoMaxBuses}
                onCreado={op => { setMostrarNuevo(false); setVista(op); }}
              />
            </div>
          </div>
        </div>
      )}
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
          <button className="ag-btn ag-btn-primary ag-btn-sm" onClick={() => setMostrarNuevo(true)}>
            + Nuevo operativo
          </button>
        </div>

        {operativos.length === 0 ? (
          <OnboardingAgencia sesion={sesion} cupoMaxBuses={cupoMaxBuses} onOperativoCreado={op => setVista(op)} />
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
function OnboardingAgencia({ sesion, cupoMaxBuses, onOperativoCreado }) {
  const [tab, setTab] = useState('bienvenida'); // bienvenida | viaje

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--ag-sep)' }}>
        {[
          { id: 'bienvenida', label: '👋 Bienvenida' },
          { id: 'viaje',      label: '📋 Primer viaje' },
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
              { n: '2', title: 'Surcante activa tu equipo', desc: 'El equipo de Surcante habilita a los gerentes de agencia para que puedan acceder al portal.' },
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
          </div>
        </div>
      )}

      {tab === 'viaje' && (
        <div className="ag-section" style={{ maxWidth: 560 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ag-text)', marginBottom: 4 }}>Crear primer viaje</div>
          <p style={{ fontSize: 13, color: 'var(--ag-text-3)', marginBottom: 20 }}>
            Completá los datos básicos. Después podrás importar pasajeros desde Excel dentro del operativo.
          </p>
          <CrearViajeForm agenciaId={sesion.agenciaId} agenciaNombre={sesion.agenciaNombre} cupoMaxBuses={cupoMaxBuses} onCreado={onOperativoCreado} />
        </div>
      )}
    </div>
  );
}

// ---- Formulario crear primer viaje ----
function CrearViajeForm({ agenciaId, agenciaNombre, cupoMaxBuses, onCreado }) {
  const [modo, setModo] = useState('manual');
  const [form, setForm] = useState({ nombre: '', destino: '', fechaInicio: '', fechaFin: '', cantBuses: 1 });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [excelDatos, setExcelDatos] = useState(null);
  const [cargandoExcel, setCargandoExcel] = useState(false);
  const [excelError, setExcelError] = useState('');
  const inputExcelRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function abrirExcel(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setExcelError('El archivo supera 10 MB.'); return; }
    setCargandoExcel(true); setExcelError('');
    try {
      const d = await parsearExcelMaestro(file);
      setExcelDatos(d);
      if (d.itinerario?.length > 0) {
        const fechas = d.itinerario.map(i => i.fecha).filter(Boolean).sort();
        if (fechas.length > 0) setForm(f => ({ ...f, fechaInicio: f.fechaInicio || fechas[0] }));
        if (fechas.length > 1) setForm(f => ({ ...f, fechaFin: f.fechaFin || fechas[fechas.length - 1] }));
      }
    } catch (e) { setExcelError(e.message || 'No se pudo leer el archivo.'); }
    setCargandoExcel(false);
  }

  async function handleCrear() {
    if (!form.nombre.trim()) { setError('Completá el nombre del viaje.'); return; }
    if (modo === 'manual' && (!form.destino.trim() || !form.fechaInicio || !form.fechaFin)) {
      setError('Completá nombre, destino y fechas.'); return;
    }
    if (modo === 'excel' && !excelDatos) { setError('Subí el archivo Excel Maestro antes de continuar.'); return; }
    if (cupoMaxBuses && modo === 'manual' && form.cantBuses > cupoMaxBuses) {
      setError(`El cupo máximo de tu agencia es de ${cupoMaxBuses} ómnibus por operativo.`); return;
    }
    setGuardando(true); setError('');
    try {
      let buses;
      if (modo === 'excel') {
        buses = [];
      } else {
        buses = Array.from({ length: Math.max(1, Number(form.cantBuses) || 1) }, (_, i) => ({
          nombre: `Bus ${i + 1}`, numero: i + 1,
        }));
      }
      const ref = await crearOperativo({
        nombre: form.nombre.trim(),
        destino: form.destino.trim(),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        agenciaId,
        agenciaNombre: agenciaNombre || '',
        estado: 'planificacion',
      }, buses);
      if (modo === 'excel' && excelDatos) {
        await importarMaestro(ref.id, excelDatos, {});
      }
      crearNotificacionOperativo({
        agenciaId,
        agenciaNombre: agenciaNombre || '',
        opId: ref.id,
        opNombre: form.nombre.trim(),
      }).catch(() => {});
      onCreado({ id: ref.id, nombre: form.nombre.trim(), destino: form.destino.trim(), fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, agenciaId, estado: 'planificacion' });
    } catch (e) {
      console.error(e); setError('No se pudo crear el viaje. Revisá la conexión.');
    }
    setGuardando(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Selector de modo */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--ag-bg-2,rgba(255,255,255,.06))', padding: 4, borderRadius: 10 }}>
        {[['manual', '✍️ Manual'], ['excel', '📊 Desde Excel']].map(([m, label]) => (
          <button key={m} onClick={() => { setModo(m); if (m === 'manual') { setExcelDatos(null); setExcelError(''); } }}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: modo === m ? 'var(--ag-accent,#7c3aed)' : 'transparent',
              color: modo === m ? '#fff' : 'var(--ag-text-2,#94a3b8)', transition: 'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      <div>
        <label className="ag-label">Nombre del viaje *</label>
        <input className="ag-input" type="text" placeholder="ej: Egresados CENS 35 — 2025"
          value={form.nombre} onChange={e => set('nombre', e.target.value)} />
      </div>

      {modo === 'manual' && <>
        {[
          { label: 'Destino', key: 'destino', type: 'text', placeholder: 'ej: Bariloche' },
          { label: 'Fecha de inicio', key: 'fechaInicio', type: 'date', placeholder: '' },
          { label: 'Fecha de fin',    key: 'fechaFin',    type: 'date', placeholder: '' },
        ].map(f => (
          <div key={f.key}>
            <label className="ag-label">{f.label}</label>
            <input className="ag-input" type={f.type} placeholder={f.placeholder}
              value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}
        <div>
          <label className="ag-label">
            Cantidad de ómnibus
            {cupoMaxBuses && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: 'var(--ag-text-3)' }}>cupo máx: {cupoMaxBuses}</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="ag-btn ag-btn-ghost ag-btn-sm"
              onClick={() => set('cantBuses', Math.max(1, form.cantBuses - 1))}>−</button>
            <span style={{ fontWeight: 700, fontSize: 18, minWidth: 24, textAlign: 'center', color: 'var(--ag-text)' }}>{form.cantBuses}</span>
            <button className="ag-btn ag-btn-ghost ag-btn-sm"
              onClick={() => set('cantBuses', cupoMaxBuses ? Math.min(cupoMaxBuses, form.cantBuses + 1) : form.cantBuses + 1)}>+</button>
          </div>
        </div>
      </>}

      {modo === 'excel' && (
        <>
          <div
            style={{ border: `2px dashed ${excelDatos ? 'var(--ag-accent,#7c3aed)' : 'rgba(255,255,255,.18)'}`,
              borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
              background: excelDatos ? 'rgba(124,58,237,.07)' : 'transparent', transition: 'all .15s' }}
            onClick={() => inputExcelRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); abrirExcel(e.dataTransfer.files?.[0]); }}>
            <div style={{ fontSize: 28 }}>{cargandoExcel ? '⏳' : excelDatos ? '✅' : '📊'}</div>
            <div style={{ fontWeight: 700, marginTop: 6, fontSize: 14, color: 'var(--ag-text)' }}>
              {cargandoExcel ? 'Leyendo archivo...' : excelDatos ? 'Excel cargado — tocá para cambiar' : 'Subí el Excel Maestro'}
            </div>
            {!excelDatos && !cargandoExcel && (
              <div style={{ fontSize: 12, color: 'var(--ag-text-2,#94a3b8)', marginTop: 4 }}>
                Arrastrá o tocá para elegir el .xlsx — buses, conductores, coordinadores, pasajeros e itinerario se importan solos.
              </div>
            )}
            {excelDatos && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
                {[['buses','🚌','Ómnibus'],['conductores','🧑‍✈️','Conductores'],['coordinadores','📋','Coordinadores'],['pasajeros','🎒','Pasajeros'],['itinerario','🗓️','Días']].map(([k,icon,label]) =>
                  excelDatos[k].length > 0 && (
                    <span key={k} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700,
                      background:'rgba(34,197,94,.15)', color:'#22c55e', borderRadius:6, padding:'3px 8px' }}>
                      {icon} {excelDatos[k].length} {label}
                    </span>
                  )
                )}
              </div>
            )}
            <input ref={inputExcelRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { abrirExcel(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {excelDatos && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Destino (opcional)', key: 'destino', type: 'text', placeholder: 'ej: Bariloche' },
                { label: 'Fecha de inicio (opcional, se detecta del itinerario)', key: 'fechaInicio', type: 'date' },
                { label: 'Fecha de fin (opcional)', key: 'fechaFin', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label className="ag-label">{f.label}</label>
                  <input className="ag-input" type={f.type} placeholder={f.placeholder || ''}
                    value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
                </div>
              ))}
            </div>
          )}
          {excelError && <div className="ag-alert ag-alert-error">{excelError}</div>}
        </>
      )}

      {error && <div className="ag-alert ag-alert-error">{error}</div>}
      <button className="ag-btn ag-btn-primary" onClick={handleCrear} disabled={guardando}>
        {guardando ? (modo === 'excel' ? 'Creando e importando...' : 'Creando...') : (modo === 'excel' ? '✓ Crear e importar datos' : '✓ Crear viaje y continuar')}
      </button>
    </div>
  );
}

// ---- Modal edición de datos del operativo ----
function EditarOperativoModal({ op, onClose, onGuardado }) {
  const s = op?.salida || {};
  const r = op?.regreso || {};
  const [form, setForm] = useState({
    nombre: op.nombre || '',
    destino: op.destino || '',
    fechaInicio: op.fechaInicio || '',
    fechaFin: op.fechaFin || '',
    salidaFecha: s.fecha || '',
    salidaHora: s.hora || '',
    salidaPresentacion: s.presentacion || '',
    salidaLugar: s.lugar || '',
    salidaDireccion: s.direccion || '',
    salidaIndicaciones: s.indicaciones || '',
    regresoFecha: r.fecha || '',
    regresoHora: r.hora || '',
    regresoLugar: r.lugar || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const iw = { width: '100%', boxSizing: 'border-box' };

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setGuardando(true); setError('');
    const t = k => form[k].trim?.() ?? form[k];
    try {
      const datos = {
        nombre: t('nombre'),
        destino: t('destino'),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        salida: {
          lugar: t('salidaLugar'),
          direccion: t('salidaDireccion'),
          fecha: form.salidaFecha || form.fechaInicio,
          hora: form.salidaHora,
          presentacion: form.salidaPresentacion,
          indicaciones: t('salidaIndicaciones'),
        },
        regreso: {
          fecha: form.regresoFecha || form.fechaFin,
          hora: form.regresoHora,
          lugar: t('regresoLugar'),
        },
      };
      await actualizarOperativo(op.id, datos);
      onGuardado({ ...op, ...datos });
      onClose();
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Sin permisos para editar.' : (e.message || 'Error al guardar.'));
    }
    setGuardando(false);
  }

  const Sec = ({ titulo }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ag-text-3)', textTransform: 'uppercase', letterSpacing: .6, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--ag-sep)' }}>
      {titulo}
    </div>
  );

  return (
    <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ag-modal" style={{ maxWidth: 560 }}>
        <div className="ag-modal-head">
          <div className="ag-modal-title">✏️ Editar datos del viaje</div>
          <button className="ag-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={guardar}>
          <div className="ag-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Datos generales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="ag-label">Nombre del viaje *</label>
                <input className="ag-input" style={iw} type="text" placeholder="Egresados CENS 35" value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="ag-label">Destino</label>
                <input className="ag-input" style={iw} type="text" placeholder="Bariloche" value={form.destino} onChange={e => set('destino', e.target.value)} />
              </div>
              <div>
                <label className="ag-label">Fecha de inicio</label>
                <input className="ag-input" style={iw} type="date" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} />
              </div>
              <div>
                <label className="ag-label">Fecha de fin</label>
                <input className="ag-input" style={iw} type="date" value={form.fechaFin} onChange={e => set('fechaFin', e.target.value)} />
              </div>
            </div>

            {/* Salida */}
            <Sec titulo="🚏 Salida" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="ag-label">Fecha de salida</label>
                <input className="ag-input" style={iw} type="date" value={form.salidaFecha} onChange={e => set('salidaFecha', e.target.value)} />
              </div>
              <div>
                <label className="ag-label">Hora de salida</label>
                <input className="ag-input" style={iw} type="time" value={form.salidaHora} onChange={e => set('salidaHora', e.target.value)} />
              </div>
              <div>
                <label className="ag-label">Hora de presentación</label>
                <input className="ag-input" style={iw} type="time" value={form.salidaPresentacion} onChange={e => set('salidaPresentacion', e.target.value)} />
              </div>
              <div>
                <label className="ag-label">Lugar de salida</label>
                <input className="ag-input" style={iw} type="text" placeholder="ej: Puerta del colegio" value={form.salidaLugar} onChange={e => set('salidaLugar', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="ag-label">Dirección</label>
                <input className="ag-input" style={iw} type="text" placeholder="Calle 123, Ciudad" value={form.salidaDireccion} onChange={e => set('salidaDireccion', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="ag-label">Indicaciones de salida</label>
                <textarea className="ag-input" style={iw} rows={2} placeholder="ej: Presentarse con DNI, valija de hasta 20 kg + bolso de mano"
                  value={form.salidaIndicaciones} onChange={e => set('salidaIndicaciones', e.target.value)} />
              </div>
            </div>

            {/* Regreso */}
            <Sec titulo="🏁 Regreso" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="ag-label">Fecha de regreso</label>
                <input className="ag-input" style={iw} type="date" value={form.regresoFecha} onChange={e => set('regresoFecha', e.target.value)} />
              </div>
              <div>
                <label className="ag-label">Hora estimada de llegada</label>
                <input className="ag-input" style={iw} type="time" value={form.regresoHora} onChange={e => set('regresoHora', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="ag-label">Lugar de llegada</label>
                <input className="ag-input" style={iw} type="text" placeholder="ej: Puerta del colegio" value={form.regresoLugar} onChange={e => set('regresoLugar', e.target.value)} />
              </div>
            </div>

            {error && <div className="ag-alert ag-alert-error">{error}</div>}
          </div>
          <div className="ag-modal-foot">
            <button type="button" className="ag-btn ag-btn-ghost ag-btn-sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="ag-btn ag-btn-primary ag-btn-sm" disabled={guardando}>
              {guardando ? 'Guardando…' : '✓ Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Detalle de operativo ----
function DetalleOperativo({ operativo: opInicial, agenciaId, onVolver }) {
  const [op, setOp] = useState(opInicial);
  const [tab, setTab] = useState('buses');
  const [buses, setBuses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pasajeros, setPasajeros] = useState([]);
  const [itinerario, setItinerario] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editarOp, setEditarOp] = useState(false);

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
      {editarOp && (
        <EditarOperativoModal
          op={op}
          onClose={() => setEditarOp(false)}
          onGuardado={opActualizado => setOp(opActualizado)}
        />
      )}
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
            <div className="ag-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {op.nombre}
              <button
                className="ag-btn ag-btn-ghost ag-btn-sm"
                style={{ fontSize: 12, padding: '2px 8px' }}
                onClick={() => setEditarOp(true)}
              >✏️ Editar</button>
            </div>
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
            {tab === 'personal' && (
              <TabPersonal
                conductores={conductores}
                coordinadores={coordinadores}
                buses={buses}
                opId={op.id}
                pasajeros={pasajeros}
              />
            )}
            {tab === 'pasajeros' && (
              <TabPasajeros
                pasajeros={pasajeros}
                buses={buses}
                staff={staff}
                opId={op.id}
                agenciaId={agenciaId}
              />
            )}
            {tab === 'itinerario' && <TabItinerario itinerario={itinerario} op={op} buses={buses} opId={op.id} />}
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
              {bus.unidadId && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--ag-sep)', fontSize: 12, color: 'var(--ag-text-3)' }}>
                  🔧 Unidad asignada por Surcante
                  {bus.interno && <span> · Int. {bus.interno}</span>}
                  {bus.tipo && <span> · {bus.tipo}</span>}
                  {bus.empresa && <span> · {bus.empresa}</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const FORM_STAFF_VACIO = { apellido: '', nombre: '', dni: '', telefono: '', email: '', busId: '', grupo: '' };

function TabPersonal({ conductores, coordinadores, buses, opId, pasajeros }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_STAFF_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(FORM_STAFF_VACIO);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');
  const [eliminando, setEliminando] = useState(null);
  const [confirmElim, setConfirmElim] = useState(null);

  function busLabel(busId) {
    return busNombre(buses.find(b => b.id === busId));
  }

  async function guardarNuevo(e) {
    e.preventDefault();
    if (!form.apellido.trim() && !form.nombre.trim()) { setError('Completá al menos el apellido o el nombre.'); return; }
    setGuardando(true); setError('');
    try {
      await crearEnSub(opId, 'staff', {
        rol: 'coordinador',
        apellido: form.apellido.trim(),
        nombre: form.nombre.trim(),
        dni: form.dni.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim().toLowerCase(),
        busId: form.busId || null,
        grupo: form.grupo.trim(),
      });
      setForm(FORM_STAFF_VACIO);
      setMostrarForm(false);
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Sin permisos.' : (e.message || 'Error al guardar.'));
    }
    setGuardando(false);
  }

  function iniciarEdicion(p) {
    setEditandoId(p.id);
    setEditForm({
      apellido: p.apellido || '',
      nombre: p.nombre || '',
      dni: p.dni || '',
      telefono: p.telefono || '',
      email: p.email || '',
      busId: p.busId || '',
      grupo: p.grupo || '',
    });
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    if (!editForm.apellido.trim() && !editForm.nombre.trim()) { setErrorEdit('Completá apellido o nombre.'); return; }
    setGuardandoEdit(true); setErrorEdit('');
    try {
      await actualizarEnSub(opId, 'staff', editandoId, {
        apellido: editForm.apellido.trim(),
        nombre: editForm.nombre.trim(),
        dni: editForm.dni.trim(),
        telefono: editForm.telefono.trim(),
        email: editForm.email.trim().toLowerCase(),
        busId: editForm.busId || null,
        grupo: editForm.grupo.trim(),
      });
      setEditandoId(null);
    } catch (e) {
      setErrorEdit(e?.code === 'permission-denied' ? 'Sin permisos.' : (e.message || 'Error al guardar.'));
    }
    setGuardandoEdit(false);
  }

  async function confirmarEliminacion() {
    if (!confirmElim) return;
    setEliminando(confirmElim.id);
    try {
      await eliminarStaff(opId, confirmElim.id, pasajeros || [], []);
    } catch (e) {
      alert(e?.code === 'permission-denied' ? 'Sin permisos para eliminar.' : (e.message || 'Error al eliminar.'));
    }
    setEliminando(null);
    setConfirmElim(null);
  }

  const todos = [
    ...conductores.map(p => ({ ...p, _rol: 'conductor' })),
    ...coordinadores.map(p => ({ ...p, _rol: 'coordinador' })),
  ].sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''));

  const camposStaff = (form, setForm) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {[
        { key: 'apellido', label: 'Apellido *', placeholder: 'García' },
        { key: 'nombre', label: 'Nombre *', placeholder: 'Ana' },
        { key: 'dni', label: 'DNI', placeholder: '30123456' },
        { key: 'telefono', label: 'Teléfono', placeholder: '1144441234' },
      ].map(f => (
        <div key={f.key}>
          <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>{f.label}</div>
          <input className="ag-input" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
        </div>
      ))}
      <div>
        <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Bus asignado</div>
        <select className="ag-input" value={form.busId} onChange={e => setForm(p => ({ ...p, busId: e.target.value }))}>
          <option value="">— Sin asignar —</option>
          {buses.map(b => <option key={b.id} value={b.id}>{busNombre(b)}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Grupo / Colegio</div>
        <input className="ag-input" value={form.grupo} onChange={e => setForm(p => ({ ...p, grupo: e.target.value }))} placeholder="Colegio San Martín" />
      </div>
    </div>
  );

  return (
    <div className="ag-section">
      {/* Modal confirmar eliminación */}
      {confirmElim && (
        <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmElim(null)}>
          <div className="ag-modal" style={{ maxWidth: 380 }}>
            <div className="ag-modal-head">
              <div className="ag-modal-title">🗑️ Eliminar personal</div>
              <button className="ag-modal-close" onClick={() => setConfirmElim(null)}>✕</button>
            </div>
            <div className="ag-modal-body">
              <p>¿Eliminás a <strong>{confirmElim.apellido} {confirmElim.nombre}</strong>?<br />
              <span style={{ fontSize: 12, color: 'var(--ag-text-3)' }}>Esta acción no se puede deshacer.</span></p>
            </div>
            <div className="ag-modal-foot">
              <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => setConfirmElim(null)}>Cancelar</button>
              <button className="ag-btn ag-btn-sm" style={{ background: 'var(--ag-red,#ef4444)', color: '#fff' }}
                onClick={confirmarEliminacion} disabled={!!eliminando}>
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="ag-btn ag-btn-primary ag-btn-sm" onClick={() => { setMostrarForm(v => !v); setError(''); setEditandoId(null); }}>
          {mostrarForm ? '✕ Cancelar' : '+ Agregar coordinador'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={guardarNuevo} style={{ background: 'var(--ag-bg-2,rgba(255,255,255,.06))', borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Nuevo coordinador</div>
          {camposStaff(form, setForm)}
          {error && <div style={{ color: 'var(--ag-red,#ef4444)', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="ag-btn ag-btn-primary ag-btn-sm" disabled={guardando}>
              {guardando ? 'Guardando…' : '✓ Guardar coordinador'}
            </button>
          </div>
        </form>
      )}

      {todos.length === 0 ? (
        <div style={{ color: 'var(--ag-text-3)', textAlign: 'center', fontSize: 13, paddingTop: 8 }}>No hay personal cargado.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ag-table">
            <thead>
              <tr>
                <th>Apellido y nombre</th>
                <th>Rol</th>
                <th>Bus</th>
                <th>Teléfono</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {todos.map(p => (
                editandoId === p.id ? (
                  <tr key={p.id} style={{ background: 'rgba(124,58,237,.07)' }}>
                    <td colSpan={5}>
                      <form onSubmit={guardarEdicion} style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {camposStaff(editForm, setEditForm)}
                        {errorEdit && <div style={{ color: 'var(--ag-red,#ef4444)', fontSize: 12 }}>{errorEdit}</div>}
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                          <button type="submit" className="ag-btn ag-btn-primary ag-btn-sm" disabled={guardandoEdit}>
                            {guardandoEdit ? 'Guardando…' : '✓ Guardar'}
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td>{p.apellido}, {p.nombre}</td>
                    <td><span className={`ag-chip ${p._rol === 'conductor' ? 'ag-chip-blue' : 'ag-chip-amber'}`}>{p._rol === 'conductor' ? 'Conductor' : 'Coordinador'}</span></td>
                    <td>{p.busId ? busLabel(p.busId) : '—'}</td>
                    <td>{p.telefono || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="ag-btn ag-btn-ghost ag-btn-sm" style={{ fontSize: 11 }} onClick={() => iniciarEdicion(p)}>✏️</button>
                        <button className="ag-btn ag-btn-ghost ag-btn-sm" style={{ fontSize: 11, color: 'var(--ag-red,#ef4444)' }}
                          onClick={() => setConfirmElim(p)} disabled={eliminando === p.id}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const FORM_PAX_VACIO = { apellido: '', nombre: '', dni: '', telefono: '', email: '', busId: '', asiento: '', habitacion: '' };

function TabPasajeros({ pasajeros, buses, staff, opId, agenciaId }) {
  const [busca, setBusca] = useState('');
  const [mostrarImport, setMostrarImport] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(FORM_PAX_VACIO);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');
  const [confirmElim, setConfirmElim] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [linksGenerados, setLinksGenerados] = useState({}); // refId → token
  const [generandoLinks, setGenerandoLinks] = useState(false);
  const [copiado, setCopiado] = useState(null);

  function busLabel(busId) { return busNombre(buses.find(b => b.id === busId)); }

  const filtrados = busca.trim()
    ? pasajeros.filter(p =>
        [p.apellido, p.nombre, p.dni].join(' ').toLowerCase().includes(busca.toLowerCase()))
    : pasajeros;

  function iniciarEdicion(p) {
    setEditandoId(p.id);
    setEditForm({
      apellido: p.apellido || '',
      nombre: p.nombre || '',
      dni: p.dni || '',
      telefono: p.telefono || '',
      email: p.email || '',
      busId: p.busId || '',
      asiento: p.asiento || '',
      habitacion: p.habitacion || '',
    });
    setErrorEdit('');
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    if (!editForm.apellido.trim() && !editForm.nombre.trim()) { setErrorEdit('Completá apellido o nombre.'); return; }
    setGuardandoEdit(true); setErrorEdit('');
    try {
      await actualizarEnSub(opId, 'pasajeros', editandoId, {
        apellido: editForm.apellido.trim(),
        nombre: editForm.nombre.trim(),
        dni: editForm.dni.trim(),
        telefono: editForm.telefono.trim(),
        email: editForm.email.trim().toLowerCase(),
        busId: editForm.busId || null,
        asiento: editForm.asiento.trim(),
        habitacion: editForm.habitacion.trim(),
      });
      setEditandoId(null);
    } catch (e) {
      setErrorEdit(e?.code === 'permission-denied' ? 'Sin permisos.' : (e.message || 'Error al guardar.'));
    }
    setGuardandoEdit(false);
  }

  async function confirmarEliminacion() {
    if (!confirmElim) return;
    setEliminando(true);
    try {
      const idElim = confirmElim.id;
      await eliminarPasajerosMasivo(opId, [idElim], []);
      setLinksGenerados(prev => { const next = { ...prev }; delete next[idElim]; return next; });
      setConfirmElim(null);
    } catch (e) {
      alert(e?.code === 'permission-denied' ? 'Sin permisos para eliminar.' : (e.message || 'Error al eliminar.'));
    }
    setEliminando(false);
  }

  async function generarLinkPasajero(p) {
    try {
      const [creado] = await generarAccesos(opId, [{ rol: 'pasajero', refId: p.id, nombre: `${p.apellido || ''} ${p.nombre || ''}`.trim() }], { agenciaId });
      setLinksGenerados(prev => ({ ...prev, [p.id]: creado.id }));
    } catch (e) {
      alert(e?.code === 'permission-denied' ? 'Sin permisos para generar links. Verificá las reglas de Firestore.' : (e.message || 'Error al generar link.'));
    }
  }

  async function generarTodosLosLinks() {
    const sinLink = pasajeros.filter(p => !linksGenerados[p.id]);
    if (sinLink.length === 0) return;
    setGenerandoLinks(true);
    try {
      const creados = await generarAccesos(
        opId,
        sinLink.map(p => ({ rol: 'pasajero', refId: p.id, nombre: `${p.apellido || ''} ${p.nombre || ''}`.trim() })),
        { agenciaId },
      );
      const nuevos = {};
      creados.forEach((c, i) => { nuevos[sinLink[i].id] = c.id; });
      setLinksGenerados(prev => ({ ...prev, ...nuevos }));
    } catch (e) {
      alert(e?.code === 'permission-denied' ? 'Sin permisos para generar links.' : (e.message || 'Error al generar links.'));
    }
    setGenerandoLinks(false);
  }

  function linkUrl(token) {
    return `${window.location.origin}/v/${token}`;
  }

  function copiarLink(token, paxId) {
    navigator.clipboard.writeText(linkUrl(token)).catch(() => {});
    setCopiado(paxId);
    setTimeout(() => setCopiado(c => c === paxId ? null : c), 2000);
  }

  const camposPax = (form, setForm) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {[
        { key: 'apellido', label: 'Apellido *', placeholder: 'Pérez' },
        { key: 'nombre', label: 'Nombre *', placeholder: 'Juan' },
        { key: 'dni', label: 'DNI', placeholder: '44000001' },
        { key: 'telefono', label: 'Teléfono', placeholder: '1166661111' },
        { key: 'asiento', label: 'Asiento', placeholder: '12' },
        { key: 'habitacion', label: 'Habitación', placeholder: '101' },
      ].map(f => (
        <div key={f.key}>
          <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>{f.label}</div>
          <input className="ag-input" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
        </div>
      ))}
      <div>
        <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Bus</div>
        <select className="ag-input" value={form.busId} onChange={e => setForm(p => ({ ...p, busId: e.target.value }))}>
          <option value="">— Sin asignar —</option>
          {buses.map(b => <option key={b.id} value={b.id}>{busNombre(b)}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Email</div>
        <input className="ag-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="juan@mail.com" />
      </div>
    </div>
  );

  return (
    <>
      {confirmElim && (
        <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmElim(null)}>
          <div className="ag-modal" style={{ maxWidth: 380 }}>
            <div className="ag-modal-head">
              <div className="ag-modal-title">🗑️ Eliminar pasajero</div>
              <button className="ag-modal-close" onClick={() => setConfirmElim(null)}>✕</button>
            </div>
            <div className="ag-modal-body">
              <p>¿Eliminás a <strong>{confirmElim.apellido} {confirmElim.nombre}</strong>?<br />
              <span style={{ fontSize: 12, color: 'var(--ag-text-3)' }}>Esta acción no se puede deshacer.</span></p>
            </div>
            <div className="ag-modal-foot">
              <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => setConfirmElim(null)}>Cancelar</button>
              <button className="ag-btn ag-btn-sm" style={{ background: 'var(--ag-red,#ef4444)', color: '#fff' }}
                onClick={confirmarEliminacion} disabled={eliminando}>
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarImport && (
        <ImportarPasajerosAgencia
          opId={opId}
          buses={buses}
          staff={staff}
          pasajeros={pasajeros}
          onClose={() => setMostrarImport(false)}
          onListo={() => setMostrarImport(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--ag-text-3)' }}>
          {pasajeros.length === 0 ? 'Sin pasajeros cargados' : `${pasajeros.length} pasajero${pasajeros.length !== 1 ? 's' : ''}`}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pasajeros.length > 0 && (
            <button
              className="ag-btn ag-btn-ghost ag-btn-sm"
              onClick={generarTodosLosLinks}
              disabled={generandoLinks || pasajeros.every(p => linksGenerados[p.id])}
            >
              {generandoLinks ? '⏳ Generando…' : `🔗 Generar links para todos (${pasajeros.filter(p => !linksGenerados[p.id]).length} sin link)`}
            </button>
          )}
          <button className="ag-btn ag-btn-primary ag-btn-sm" onClick={() => setMostrarImport(true)}>
            📥 Importar desde Excel
          </button>
        </div>
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
                <th>Bus / Asiento</th>
                <th>Link</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                editandoId === p.id ? (
                  <tr key={p.id} style={{ background: 'rgba(124,58,237,.07)' }}>
                    <td colSpan={6}>
                      <form onSubmit={guardarEdicion} style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {camposPax(editForm, setEditForm)}
                        {errorEdit && <div style={{ color: 'var(--ag-red,#ef4444)', fontSize: 12 }}>{errorEdit}</div>}
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                          <button type="submit" className="ag-btn ag-btn-primary ag-btn-sm" disabled={guardandoEdit}>
                            {guardandoEdit ? 'Guardando…' : '✓ Guardar'}
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--ag-text-3)' }}>{i + 1}</td>
                    <td>{p.apellido}, {p.nombre}</td>
                    <td>{p.dni || '—'}</td>
                    <td>{p.busId ? busLabel(p.busId) : '—'}{p.asiento ? ` · #${p.asiento}` : ''}</td>
                    <td>
                      {linksGenerados[p.id] ? (
                        <button
                          className="ag-btn ag-btn-ghost ag-btn-sm"
                          style={{ fontSize: 11, color: 'var(--ag-accent)' }}
                          onClick={() => copiarLink(linksGenerados[p.id], p.id)}
                        >
                          {copiado === p.id ? '✓ Copiado' : '📋 Copiar link'}
                        </button>
                      ) : (
                        <button
                          className="ag-btn ag-btn-ghost ag-btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => generarLinkPasajero(p)}
                        >
                          🔗 Generar
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="ag-btn ag-btn-ghost ag-btn-sm" style={{ fontSize: 11 }} onClick={() => iniciarEdicion(p)}>✏️</button>
                        <button className="ag-btn ag-btn-ghost ag-btn-sm" style={{ fontSize: 11, color: 'var(--ag-red,#ef4444)' }}
                          onClick={() => setConfirmElim(p)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
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

const ACT_VACIA = { hora: '', horaFin: '', titulo: '', lugar: '', direccion: '', buses: [], soloStaff: false, paraPasajeros: '', paraConductores: '', paraCoordinadores: '' };
const DIA_VACIO = { titulo: '', resumen: '', sugerencias: '', notasConductores: '', notasCoordinadores: '' };
const porHora = (a, b) => String(a.hora || '99:99').localeCompare(String(b.hora || '99:99'));

function TabItinerario({ itinerario, op, buses, opId }) {
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [editAct, setEditAct] = useState(null);   // { fecha, act? }
  const [editDia, setEditDia] = useState(null);    // fecha
  const [eliminandoAct, setEliminandoAct] = useState(null); // { fecha, actId }

  const porFecha = useMemo(() => {
    const m = {};
    itinerario.forEach(d => { m[d.fecha || d.id] = d; });
    return m;
  }, [itinerario]);

  const fechasViaje = rangoFechas(op?.fechaInicio, op?.fechaFin);
  const fechas = [...new Set([...fechasViaje, ...Object.keys(porFecha)])].sort();
  const hoy = hoyISO();

  function toggle(f) {
    setAbiertos(prev => { const n = new Set(prev); if (n.has(f)) n.delete(f); else n.add(f); return n; });
  }

  async function guardarActividad(fecha, act) {
    const dia = porFecha[fecha] || {};
    const lista = [...(dia.actividades || [])];
    const i = lista.findIndex(a => a.id === act.id);
    if (i >= 0) lista[i] = act; else lista.push(act);
    lista.sort(porHora);
    await guardarEnSub(opId, 'itinerario', fecha, { fecha, actividades: lista });
    setAbiertos(prev => new Set(prev).add(fecha));
  }

  async function borrarActividad(fecha, actId) {
    const dia = porFecha[fecha] || {};
    await guardarEnSub(opId, 'itinerario', fecha, { fecha, actividades: (dia.actividades || []).filter(a => a.id !== actId) });
    setEliminandoAct(null);
  }

  if (!op?.fechaInicio) {
    return <div className="ag-section" style={{ color: 'var(--ag-text-3)', textAlign: 'center', fontSize: 13 }}>Cargá las fechas del viaje para armar el itinerario.</div>;
  }

  if (fechas.length === 0) {
    return <div className="ag-section" style={{ color: 'var(--ag-text-3)', textAlign: 'center', fontSize: 13 }}>No hay itinerario cargado.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => setAbiertos(abiertos.size ? new Set() : new Set(fechas))}>
          {abiertos.size ? 'Contraer todo' : 'Expandir todo'}
        </button>
      </div>

      {fechas.map(fecha => {
        const dia = porFecha[fecha] || {};
        const acts = [...(dia.actividades || [])].sort(porHora);
        const nroDia = fechasViaje.indexOf(fecha) + 1;
        const abierto = abiertos.has(fecha);
        return (
          <div key={fecha} className="ag-section" style={{ padding: 0, overflow: 'hidden', ...(fecha === hoy ? { boxShadow: '0 0 0 2px var(--ag-accent)' } : {}) }}>
            {/* cabecera del día */}
            <div
              onClick={() => toggle(fecha)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 36, textAlign: 'center', background: 'var(--ag-bg-3,rgba(255,255,255,.04))', borderRadius: 8, padding: '2px 0', fontSize: 11, fontWeight: 800, lineHeight: 1.3 }}>
                  <div>{nroDia > 0 ? nroDia : '·'}</div><div style={{ fontWeight: 400, opacity: .7 }}>DÍA</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{labelFecha(fecha, { largo: true })}{dia.titulo ? ` · ${dia.titulo}` : ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ag-text-3)', marginTop: 1 }}>
                    {acts.length ? `${acts.length} actividad${acts.length === 1 ? '' : 'es'}` : 'Sin actividades'}
                    {fecha === hoy && <span className="ag-chip ag-chip-green" style={{ marginLeft: 6, fontSize: 10 }}>Hoy</span>}
                  </div>
                </div>
              </div>
              <span style={{ color: 'var(--ag-text-3)', fontSize: 13 }}>{abierto ? '▲' : '▼'}</span>
            </div>

            {abierto && (
              <div style={{ borderTop: '1px solid var(--ag-sep)', padding: '12px 16px' }}>
                {/* notas del día */}
                {(dia.resumen || dia.sugerencias || dia.notasConductores || dia.notasCoordinadores) && (
                  <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dia.resumen && <div style={{ fontSize: 12.5, color: 'var(--ag-text-2)', background: 'rgba(99,102,241,.08)', borderRadius: 6, padding: '6px 10px' }}><b>Resumen:</b> {dia.resumen}</div>}
                    {dia.sugerencias && <div style={{ fontSize: 12.5, color: 'var(--ag-text-2)', background: 'rgba(99,102,241,.08)', borderRadius: 6, padding: '6px 10px' }}><b>💡 Sugerencias:</b> {dia.sugerencias}</div>}
                    {dia.notasConductores && <div style={{ fontSize: 12.5, color: 'var(--ag-text-2)', background: 'rgba(45,212,191,.08)', borderRadius: 6, padding: '6px 10px' }}><b>🧑‍✈️ Conductores:</b> {dia.notasConductores}</div>}
                    {dia.notasCoordinadores && <div style={{ fontSize: 12.5, color: 'var(--ag-text-2)', background: 'rgba(16,185,129,.08)', borderRadius: 6, padding: '6px 10px' }}><b>📋 Coordinadores:</b> {dia.notasCoordinadores}</div>}
                  </div>
                )}

                {/* actividades */}
                {acts.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ag-text-3)', paddingBottom: 8 }}>Todavía no hay actividades este día.</div>}
                {acts.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--ag-sep)' }}>
                    <div style={{ minWidth: 48, fontSize: 12, fontWeight: 700, color: 'var(--ag-text-3)', paddingTop: 1 }}>
                      {a.hora || '--:--'}{a.horaFin && <div style={{ fontWeight: 400, fontSize: 10.5 }}>↓{a.horaFin}</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.titulo || 'Actividad'} {a.soloStaff && <span className="ag-chip ag-chip-amber" style={{ fontSize: 10 }}>Solo staff</span>}</div>
                      {(a.lugar || a.direccion) && <div style={{ fontSize: 12, color: 'var(--ag-text-3)', marginTop: 2 }}>📍 {[a.lugar, a.direccion].filter(Boolean).join(' · ')}</div>}
                      {(a.paraPasajeros || a.paraConductores || a.paraCoordinadores) && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {a.paraPasajeros && !a.soloStaff && <div style={{ fontSize: 12, background: 'rgba(99,102,241,.08)', borderRadius: 4, padding: '3px 7px' }}>🎒 {a.paraPasajeros}</div>}
                          {a.paraConductores && <div style={{ fontSize: 12, background: 'rgba(45,212,191,.08)', borderRadius: 4, padding: '3px 7px' }}>🧑‍✈️ {a.paraConductores}</div>}
                          {a.paraCoordinadores && <div style={{ fontSize: 12, background: 'rgba(16,185,129,.08)', borderRadius: 4, padding: '3px 7px' }}>📋 {a.paraCoordinadores}</div>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="ag-btn ag-btn-ghost ag-btn-sm" style={{ fontSize: 11 }} onClick={() => setEditAct({ fecha, act: a })}>✏️</button>
                      <button className="ag-btn ag-btn-ghost ag-btn-sm" style={{ fontSize: 11, color: 'var(--ag-red,#ef4444)' }} onClick={() => setEliminandoAct({ fecha, actId: a.id, titulo: a.titulo })}>🗑️</button>
                    </div>
                  </div>
                ))}

                {/* acciones del día */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  <button className="ag-btn ag-btn-primary ag-btn-sm" onClick={() => setEditAct({ fecha })}>+ Actividad</button>
                  <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => setEditDia(fecha)}>📝 Notas del día</button>
                  {porFecha[fecha] && (
                    <button className="ag-btn ag-btn-ghost ag-btn-sm" style={{ color: 'var(--ag-red,#ef4444)', marginLeft: 'auto' }}
                      onClick={async () => { if (window.confirm('¿Vaciar todas las actividades de este día?')) await eliminarEnSub(opId, 'itinerario', fecha); }}>
                      Vaciar día
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal confirmar eliminar actividad */}
      {eliminandoAct && (
        <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && setEliminandoAct(null)}>
          <div className="ag-modal" style={{ maxWidth: 360 }}>
            <div className="ag-modal-head">
              <div className="ag-modal-title">🗑️ Eliminar actividad</div>
              <button className="ag-modal-close" onClick={() => setEliminandoAct(null)}>✕</button>
            </div>
            <div className="ag-modal-body">
              <p>¿Eliminás <strong>{eliminandoAct.titulo || 'esta actividad'}</strong>?</p>
            </div>
            <div className="ag-modal-foot">
              <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => setEliminandoAct(null)}>Cancelar</button>
              <button className="ag-btn ag-btn-sm" style={{ background: 'var(--ag-red,#ef4444)', color: '#fff' }}
                onClick={() => borrarActividad(eliminandoAct.fecha, eliminandoAct.actId)}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar/crear actividad */}
      {editAct && (
        <ActividadFormAgencia
          fecha={editAct.fecha}
          act={editAct.act}
          buses={buses}
          onClose={() => setEditAct(null)}
          onGuardar={async act => { await guardarActividad(editAct.fecha, act); setEditAct(null); }}
        />
      )}

      {/* Modal notas del día */}
      {editDia && (
        <DiaFormAgencia
          fecha={editDia}
          dia={porFecha[editDia]}
          onClose={() => setEditDia(null)}
          onGuardar={async data => { await guardarEnSub(opId, 'itinerario', editDia, { fecha: editDia, ...(porFecha[editDia] || {}), ...data }); setEditDia(null); }}
        />
      )}
    </div>
  );
}

function ActividadFormAgencia({ fecha, act, buses, onClose, onGuardar }) {
  const [form, setForm] = useState(() => ({ ...ACT_VACIA, ...(act || {}), buses: act?.buses || [] }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function toggleBus(id) {
    setForm(f => ({ ...f, buses: f.buses.includes(id) ? f.buses.filter(x => x !== id) : [...f.buses, id] }));
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.titulo.trim()) { setError('Poné un título a la actividad.'); return; }
    setGuardando(true);
    try {
      const t = v => String(v ?? '').trim();
      await onGuardar({
        id: act?.id || generarToken(8),
        hora: form.hora, horaFin: form.horaFin,
        titulo: t(form.titulo), lugar: t(form.lugar), direccion: t(form.direccion),
        buses: form.buses.filter(id => buses.some(b => b.id === id)),
        soloStaff: !!form.soloStaff,
        paraPasajeros: t(form.paraPasajeros),
        paraConductores: t(form.paraConductores),
        paraCoordinadores: t(form.paraCoordinadores),
      });
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Sin permisos.' : (e.message || 'Error al guardar.'));
      setGuardando(false);
    }
  }

  const F = k => ({ value: form[k], onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) });
  const inputStyle = { width: '100%', boxSizing: 'border-box' };

  return (
    <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ag-modal" style={{ maxWidth: 560 }}>
        <div className="ag-modal-head">
          <div className="ag-modal-title">{act ? 'Editar actividad' : 'Nueva actividad'} · {labelFecha(fecha, { largo: true })}</div>
          <button className="ag-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={guardar}>
          <div className="ag-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Hora</div>
                <input className="ag-input" type="time" style={inputStyle} {...F('hora')} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Hasta (opcional)</div>
                <input className="ag-input" type="time" style={inputStyle} {...F('horaFin')} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Actividad *</div>
                <input className="ag-input" style={inputStyle} placeholder="ej: Excursión Cerro Catedral" autoFocus {...F('titulo')} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Lugar</div>
                <input className="ag-input" style={inputStyle} placeholder="ej: Base Cerro Catedral" {...F('lugar')} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Dirección (para el mapa)</div>
                <input className="ag-input" style={inputStyle} placeholder="Av. de los Pioneros 1234" {...F('direccion')} />
              </div>
            </div>

            {buses.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 5 }}>Aplica a (sin marcar = todos los buses)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {buses.map(b => (
                    <button key={b.id} type="button"
                      className={`ag-btn ag-btn-sm ${form.buses.includes(b.id) ? 'ag-btn-primary' : 'ag-btn-ghost'}`}
                      onClick={() => toggleBus(b.id)}>
                      {busNombre(b)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>🎒 Info para pasajeros</div>
              <textarea className="ag-input" rows={2} style={inputStyle} placeholder="ej: Llevar ropa de nieve, guantes y protector solar." {...F('paraPasajeros')} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>🧑‍✈️ Indicaciones para conductores</div>
              <textarea className="ag-input" rows={2} style={inputStyle} placeholder="ej: Estacionar en playón B. Esperar hasta las 17 h." {...F('paraConductores')} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>📋 Indicaciones para coordinadores</div>
              <textarea className="ag-input" rows={2} style={inputStyle} placeholder="ej: Retirar vouchers en boletería. Control de presentes." {...F('paraCoordinadores')} />
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 500 }}>
              <input type="checkbox" checked={!!form.soloStaff} onChange={e => setForm(f => ({ ...f, soloStaff: e.target.checked }))} />
              No mostrar a los pasajeros (solo staff)
            </label>

            {error && <div style={{ color: 'var(--ag-red,#ef4444)', fontSize: 12 }}>{error}</div>}
          </div>
          <div className="ag-modal-foot">
            <button type="button" className="ag-btn ag-btn-ghost ag-btn-sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="ag-btn ag-btn-primary ag-btn-sm" disabled={guardando}>
              {guardando ? 'Guardando…' : '✓ Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DiaFormAgencia({ fecha, dia, onClose, onGuardar }) {
  const [form, setForm] = useState(() => ({ ...DIA_VACIO, ...(dia || {}) }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const inputStyle = { width: '100%', boxSizing: 'border-box' };
  const F = k => ({ value: form[k] || '', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) });

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const data = {};
      Object.keys(DIA_VACIO).forEach(k => { data[k] = String(form[k] ?? '').trim(); });
      await onGuardar(data);
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Sin permisos.' : (e.message || 'Error al guardar.'));
      setGuardando(false);
    }
  }

  return (
    <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ag-modal" style={{ maxWidth: 500 }}>
        <div className="ag-modal-head">
          <div className="ag-modal-title">📝 Notas · {labelFecha(fecha, { largo: true })}</div>
          <button className="ag-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={guardar}>
          <div className="ag-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>Título del día</div>
              <input className="ag-input" style={inputStyle} placeholder="ej: Día de nieve" autoFocus {...F('titulo')} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>🎒 Resumen para pasajeros</div>
              <textarea className="ag-input" rows={3} style={inputStyle} placeholder="Qué van a hacer hoy, en pocas palabras." {...F('resumen')} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>💡 Sugerencias para pasajeros</div>
              <textarea className="ag-input" rows={2} style={inputStyle} placeholder="ej: Abrigarse bien, llevar agua y cargar el celular." {...F('sugerencias')} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>🧑‍✈️ Notas generales para conductores</div>
              <textarea className="ag-input" rows={2} style={inputStyle} {...F('notasConductores')} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ag-text-3)', marginBottom: 3 }}>📋 Notas generales para coordinadores</div>
              <textarea className="ag-input" rows={2} style={inputStyle} {...F('notasCoordinadores')} />
            </div>
            {error && <div style={{ color: 'var(--ag-red,#ef4444)', fontSize: 12 }}>{error}</div>}
          </div>
          <div className="ag-modal-foot">
            <button type="button" className="ag-btn ag-btn-ghost ag-btn-sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="ag-btn ag-btn-primary ag-btn-sm" disabled={guardando}>
              {guardando ? 'Guardando…' : '✓ Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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

  const handleLoginCodigo = useCallback(async (codigoInput) => {
    loginInProgressRef.current = true;
    setEstado('cargando');
    setErrorMsg('');
    try {
      let dispositivoId;
      try {
        dispositivoId = localStorage.getItem('surcante_ag_dispositivo');
        if (!dispositivoId) {
          dispositivoId = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
          localStorage.setItem('surcante_ag_dispositivo', dispositivoId);
        }
      } catch (_) {
        dispositivoId = 'unknown_' + Date.now();
      }

      const resp = await fetch('/api/agencia-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoInput, dispositivoId }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      await signOut(auth).catch(() => {});
      await signInWithCustomToken(auth, data.customToken);

      setSesion({
        uid: auth.currentUser?.uid || `agencia_${data.agenciaId}`,
        agenciaId: data.agenciaId,
        nombre: data.agenciaNombre || '',
        agenciaNombre: data.agenciaNombre || '',
      });
      setEstado('ok');
    } catch (e) {
      console.error(e);
      try { await signOut(auth); } catch (_) { /* noop */ }
      setErrorMsg(e.message || 'Código inválido.');
      setEstado('login');
    } finally {
      loginInProgressRef.current = false;
    }
  }, []);

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
        onLoginCodigo={handleLoginCodigo}
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
