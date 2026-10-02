import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, getDoc, getDocs, setDoc, collection, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { colorBus, labelFecha, hoyISO } from '../admin/egresados/utils';

function diaActivoDeItinerario(itinerario, hoy) {
  if (!itinerario.length) return null;
  const actual = itinerario.find(d => d.id === hoy);
  if (actual) return actual;
  const futuros = itinerario.filter(d => d.id > hoy);
  return futuros.length ? futuros[0] : itinerario[itinerario.length - 1];
}

export default function PortalConductor({ sesion }) {
  const { opId, refId, busId } = sesion;
  const hoy = useMemo(() => hoyISO(), []);
  const [tab, setTab] = useState('hoy');
  const [op, setOp] = useState(null);
  const [bus, setBus] = useState(null);
  const [pasajeros, setPasajeros] = useState([]);
  const [itinerario, setItinerario] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [abiertos, setAbiertos] = useState({});

  useEffect(() => {
    getDoc(doc(db, 'operativos', opId))
      .then(s => s.exists() && setOp({ id: s.id, ...s.data() }));
    if (busId) {
      getDoc(doc(db, 'operativos', opId, 'buses', busId))
        .then(s => s.exists() && setBus({ id: s.id, ...s.data() }));
      const q = query(collection(db, 'operativos', opId, 'pasajeros'), where('busId', '==', busId));
      getDocs(q).then(snap =>
        setPasajeros(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es')))
      );
    }
    const unsubs = [
      onSnapshot(collection(db, 'operativos', opId, 'itinerario'), snap => {
        setItinerario(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)));
      }),
      onSnapshot(collection(db, 'operativos', opId, 'avisos'), snap =>
        setAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0)))
      ),
    ];
    return () => unsubs.forEach(u => u());
  }, [opId, refId, busId]);

  const diaActivo = useMemo(() => diaActivoDeItinerario(itinerario, hoy), [itinerario, hoy]);

  useEffect(() => {
    if (diaActivo) setAbiertos(prev => ({ ...prev, [diaActivo.id]: true }));
  }, [diaActivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const busColor = colorBus(bus);

  const paxFiltrados = pasajeros.filter(p => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(q);
  });

  return (
    <div className="portal-wrap">
      <header className="portal-header">
        <span className="portal-header-logo">🧑‍✈️</span>
        <div>
          <div className="portal-header-title">{op?.nombre || 'Mi viaje'}</div>
          <div className="portal-header-sub">{sesion.nombre || 'Conductor'}</div>
        </div>
        {bus && (
          <div className="portal-bus-badge" style={{ background: busColor }}>
            {bus.codigo || 'Bus'}
          </div>
        )}
      </header>

      <nav className="portal-tabs">
        {[['hoy', 'Hoy'], ['agenda', 'Agenda'], ['servicio', 'Servicio'], ['pasajeros', 'Pasajeros']].map(([id, label]) => (
          <button key={id} className={`portal-tab${tab === id ? ' activo' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="portal-main">
        {tab === 'hoy'      && <TabHoyConductor dia={diaActivo} avisos={avisos} fecha={hoy} busId={busId} />}
        {tab === 'agenda'   && <TabAgendaConductor itinerario={itinerario} hoy={hoy} busId={busId} abiertos={abiertos} setAbiertos={setAbiertos} />}
        {tab === 'servicio' && <TabServicio opId={opId} busId={busId} refId={refId} bus={bus} busColor={busColor} />}
        {tab === 'pasajeros' && (
          <div className="portal-section">
            <input
              className="portal-busqueda"
              placeholder="Buscar por nombre o DNI…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {paxFiltrados.length === 0
              ? <div className="portal-empty">Sin pasajeros{busqueda ? ' con ese criterio' : ' asignados a tu bus'}.</div>
              : paxFiltrados.map(p => <FilaPax key={p.id} pax={p} />)
            }
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Hoy ── */
function TabHoyConductor({ dia, avisos, fecha, busId }) {
  const actividades = (dia?.actividades || []).filter(a => !busId || !a.buses?.length || a.buses.includes(busId));
  const esHoy = dia?.id === fecha;
  const etiqueta = !dia ? labelFecha(fecha, { largo: true })
    : esHoy ? labelFecha(fecha, { largo: true })
    : dia.id > fecha
      ? `Próximas actividades · ${labelFecha(dia.id, { largo: true })}`
      : `Último día del viaje · ${labelFecha(dia.id, { largo: true })}`;
  return (
    <div className="portal-section">
      <div className="portal-card-label">{etiqueta}</div>
      {!dia && (
        <div className="portal-card">
          <p style={{ fontSize: 13, color: '#b0b0c8', margin: 0 }}>El itinerario del viaje todavía no está cargado.</p>
        </div>
      )}
      {dia && actividades.length === 0 && (
        <div className="portal-card">
          <p style={{ fontSize: 13, color: '#b0b0c8', margin: 0 }}>Sin actividades para este día.</p>
        </div>
      )}
      {actividades.map((act, i) => (
        <div key={i} className="portal-actividad">
          <div className="portal-act-hora">{act.hora || '—'}</div>
          <div>
            <div className="portal-act-titulo">{act.titulo}</div>
            {(act.paraPasajeros || act.nota) && <div className="portal-act-nota">{act.paraPasajeros || act.nota}</div>}
            {(act.paraConductores || act.notaConductor) && <div className="portal-act-nota nota-conductor">🧑‍✈️ {act.paraConductores || act.notaConductor}</div>}
          </div>
        </div>
      ))}
      {(dia?.resumen || dia?.notaGeneral) && (
        <div className="portal-card portal-info-general"><p>{dia.resumen || dia.notaGeneral}</p></div>
      )}
      {dia?.notasConductores && (
        <div className="portal-card portal-info-general"><p>🧑‍✈️ {dia.notasConductores}</p></div>
      )}
      {avisos.map(a => (
        <div key={a.id} className="portal-aviso-row">
          <div className="portal-aviso-texto">{a.texto}</div>
          {a.creadoEn && (
            <div className="portal-aviso-hora">
              {new Date(a.creadoEn.seconds * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Servicio GPS ── */
function TabServicio({ opId, busId, refId, bus, busColor }) {
  const [activo, setActivo] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const [errorGps, setErrorGps] = useState('');
  const watchRef = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => () => detener(), []);

  async function iniciar() {
    if (!busId) { setErrorGps('No tenés un ómnibus asignado.'); return; }
    if (!navigator.geolocation) { setErrorGps('Tu dispositivo no tiene GPS.'); return; }
    setErrorGps('');
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (_) { /* wake lock opcional */ }
    watchRef.current = navigator.geolocation.watchPosition(
      async pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setPosicion({ lat, lng, accuracy, ts: Date.now() });
        try {
          await setDoc(doc(db, 'operativos', opId, 'ubicaciones', busId), {
            lat, lng, accuracy,
            ts: serverTimestamp(),
            conductorId: refId,
          });
        } catch (e) {
          console.error('[GPS write]', e.message);
        }
      },
      err => setErrorGps(`GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
    );
    setActivo(true);
  }

  function detener() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    setActivo(false);
  }

  return (
    <div className="portal-section">
      <div className="portal-card">
        <div className="portal-card-header">Tu ómnibus</div>
        {bus ? (
          <>
            <div className="portal-bus-nombre">{bus.nombre || bus.codigo || 'Ómnibus'}</div>
            {bus.interno && <div className="portal-bus-meta">Interno {bus.interno}</div>}
            {bus.color && (
              <div style={{ marginTop: 8 }}>
                <span className="portal-chip" style={{ color: busColor, borderColor: busColor }}>
                  {bus.codigo || bus.color}
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#b0b0c8' }}>Sin ómnibus asignado.</div>
        )}
      </div>

      <div className="portal-card">
        <div className="portal-card-header">GPS en línea</div>
        <div className={`portal-servicio-estado${activo ? ' activo' : ''}`}>
          <div className="portal-servicio-dot" />
          {activo ? 'Servicio activo — transmitiendo' : 'Servicio detenido'}
        </div>
        {posicion && activo && (
          <div className="portal-gps-info">
            {posicion.lat.toFixed(5)}, {posicion.lng.toFixed(5)}
            {posicion.accuracy && ` · ±${Math.round(posicion.accuracy)} m`}
          </div>
        )}
        {errorGps && <div className="portal-aviso-warning" style={{ marginBottom: 10 }}>{errorGps}</div>}
        <div className="portal-info-text" style={{ marginBottom: 12 }}>
          {activo
            ? 'La pantalla se mantiene encendida mientras el servicio está activo. Tap en "Detener" al terminar la jornada.'
            : 'Iniciá el servicio cuando subas al ómnibus. Los pasajeros y coordinadores podrán ver la ubicación en tiempo real.'}
        </div>
        {!activo
          ? <button className="portal-btn-primary portal-btn-iniciar" onClick={iniciar} disabled={!busId}>Iniciar servicio</button>
          : <button className="portal-btn-danger" onClick={detener}>Detener servicio</button>
        }
      </div>
    </div>
  );
}

/* ── Agenda ── */
function TabAgendaConductor({ itinerario, hoy, busId, abiertos, setAbiertos }) {
  const toggle = id => setAbiertos(prev => ({ ...prev, [id]: !prev[id] }));
  if (itinerario.length === 0) return (
    <div className="portal-section">
      <div className="portal-card">
        <p style={{ fontSize: 13, color: '#b0b0c8', margin: 0 }}>La agenda del viaje todavía no está cargada.</p>
      </div>
    </div>
  );
  return (
    <div className="portal-section">
      {itinerario.map(dia => {
        const esHoy = dia.id === hoy;
        const abierto = abiertos[dia.id];
        const actividades = (dia.actividades || []).filter(a => !busId || !a.buses?.length || a.buses.includes(busId));
        return (
          <div key={dia.id} className={`portal-dia-card${esHoy ? ' hoy' : ''}`}>
            <button className="portal-dia-header" onClick={() => toggle(dia.id)}>
              <span>{labelFecha(dia.id, { largo: true })}{esHoy ? ' — hoy' : ''}</span>
              <span className="portal-dia-toggle">{abierto ? '▲' : '▼'}</span>
            </button>
            {abierto && (
              <div className="portal-dia-body">
                {actividades.length === 0
                  ? <div className="portal-empty-sm">Sin actividades</div>
                  : actividades.map((act, i) => (
                    <div key={i} className="portal-actividad" style={{ padding: '8px 0', borderBottom: i < actividades.length - 1 ? '1px solid #f0ecf8' : 'none', border: 'none', borderRadius: 0 }}>
                      <div className="portal-act-hora">{act.hora || '—'}</div>
                      <div>
                        <div className="portal-act-titulo">{act.titulo}</div>
                        {(act.paraPasajeros || act.nota) && <div className="portal-act-nota">{act.paraPasajeros || act.nota}</div>}
                        {(act.paraConductores || act.notaConductor) && <div className="portal-act-nota nota-conductor">🧑‍✈️ {act.paraConductores || act.notaConductor}</div>}
                      </div>
                    </div>
                  ))
                }
                {(dia.resumen || dia.notaGeneral) && <div className="portal-info-text">{dia.resumen || dia.notaGeneral}</div>}
                {dia.notasConductores && <div className="portal-info-text">🧑‍✈️ {dia.notasConductores}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Fila pasajero ── */
function FilaPax({ pax }) {
  return (
    <div className="portal-pax-row">
      <div className="portal-pax-nombre">{pax.apellido ? `${pax.apellido}, ${pax.nombre}` : pax.nombre}</div>
      <div className="portal-pax-datos">
        {pax.dni && <span>DNI {pax.dni}</span>}
        {pax.hotel && <span>{pax.hotel}</span>}
        {pax.habitacion && <span>Hab. {pax.habitacion}</span>}
        {pax.asiento && <span>Asiento {pax.asiento}</span>}
      </div>
    </div>
  );
}
