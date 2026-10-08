import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, getDoc, getDocs, collection, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { colorBus, labelFecha, hoyISO, nombreCompleto, diaActivoDeItinerario } from '../admin/egresados/utils';

export default function PortalCoordinador({ sesion }) {
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
  const [errorFirestore, setErrorFirestore] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'operativos', opId))
      .then(s => s.exists() && setOp({ id: s.id, ...s.data() }));
    if (busId) {
      getDoc(doc(db, 'operativos', opId, 'buses', busId))
        .then(s => s.exists() && setBus({ id: s.id, ...s.data() }));
    }
    getDocs(collection(db, 'operativos', opId, 'pasajeros')).then(snap =>
      setPasajeros(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es')))
    );
    const unsubs = [
      onSnapshot(
        collection(db, 'operativos', opId, 'itinerario'),
        snap => {
          setItinerario(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)));
          setErrorFirestore('');
        },
        err => setErrorFirestore(err.code || err.message)
      ),
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
    return `${p.nombre} ${p.apellido} ${p.dni} ${p.codigoAgencia || ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="portal-wrap">
      <header className="portal-header">
        <span className="portal-header-logo">📋</span>
        <div>
          <div className="portal-header-title">{op?.nombre || 'Mi viaje'}</div>
          <div className="portal-header-sub">{sesion.nombre || 'Coordinador'}</div>
        </div>
        {bus && (
          <div className="portal-bus-badge" style={{ background: busColor }}>
            {bus.codigo || 'Bus'}
          </div>
        )}
      </header>

      <nav className="portal-tabs">
        {[['hoy', 'Hoy'], ['agenda', 'Agenda'], ['pasajeros', 'Pasajeros'], ['qr', 'Escáner QR']].map(([id, label]) => (
          <button key={id} className={`portal-tab${tab === id ? ' activo' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="portal-main">
        {errorFirestore && (
          <div className="portal-card" style={{ margin: '12px 0', background: '#2d1a1a', borderLeft: '3px solid #cf1322', fontSize: 13, color: '#ff6b6b' }}>
            ⚠️ Error al cargar datos: <code>{errorFirestore}</code>. Si el problema persiste, contactá al administrador.
          </div>
        )}
        {tab === 'hoy' && <TabHoyCoord dia={diaActivo} avisos={avisos} fecha={hoy} busId={busId} />}
        {tab === 'agenda' && <TabAgendaCoord itinerario={itinerario} hoy={hoy} busId={busId} abiertos={abiertos} setAbiertos={setAbiertos} />}
        {tab === 'pasajeros' && (
          <div className="portal-section">
            <input
              className="portal-busqueda"
              placeholder="Buscar por nombre, DNI o código…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {paxFiltrados.length === 0
              ? <div className="portal-empty">Sin pasajeros{busqueda ? ' con ese criterio' : ''}.</div>
              : paxFiltrados.map(p => <FilaPax key={p.id} pax={p} />)
            }
          </div>
        )}
        {tab === 'qr' && (
          <TabQR opId={opId} refId={refId} pasajeros={pasajeros} />
        )}
      </main>
    </div>
  );
}

/* ── Hoy ── */
function TabHoyCoord({ dia, avisos, fecha, busId }) {
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
            {(act.paraCoordinadores || act.notaCoord) && <div className="portal-act-nota nota-coord">📋 {act.paraCoordinadores || act.notaCoord}</div>}
          </div>
        </div>
      ))}
      {(dia?.resumen || dia?.notaGeneral) && (
        <div className="portal-card portal-info-general"><p>{dia.resumen || dia.notaGeneral}</p></div>
      )}
      {dia?.notasCoordinadores && (
        <div className="portal-card portal-info-general"><p>📋 {dia.notasCoordinadores}</p></div>
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

/* ── Agenda ── */
function TabAgendaCoord({ itinerario, hoy, busId, abiertos, setAbiertos }) {
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
                        {(act.paraCoordinadores || act.notaCoord) && <div className="portal-act-nota nota-coord">📋 {act.paraCoordinadores || act.notaCoord}</div>}
                      </div>
                    </div>
                  ))
                }
                {(dia.resumen || dia.notaGeneral) && <div className="portal-info-text">{dia.resumen || dia.notaGeneral}</div>}
                {dia.notasCoordinadores && <div className="portal-info-text">📋 {dia.notasCoordinadores}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── QR Scanner ── */
const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

function cargarJsQR() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = JSQR_CDN;
    s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error('No se pudo cargar el escáner. Verificá la conexión.'));
    document.head.appendChild(s);
  });
}

function TabQR({ opId, refId, pasajeros }) {
  const [escaneando, setEscaneando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, pax, codigo }
  const [errorCam, setErrorCam] = useState('');
  const [errorCheckin, setErrorCheckin] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => () => detener(), []);

  async function iniciar() {
    setResultado(null);
    setErrorCam('');
    setErrorCheckin('');
    try {
      await cargarJsQR();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setEscaneando(true);
      escanearFrame();
    } catch (e) {
      setErrorCam(e.message || 'No se pudo acceder a la cámara.');
    }
  }

  function detener() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setEscaneando(false);
  }

  function escanearFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) { rafRef.current = requestAnimationFrame(escanearFrame); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR?.(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) {
      detener();
      procesarCodigo(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(escanearFrame);
  }

  async function procesarCodigo(codigo) {
    const limpio = codigo.trim();
    // Buscar por ID del doc, codigoAgencia, o DNI
    let encontrado = pasajeros.find(p => p.id === limpio)
      || pasajeros.find(p => p.codigoAgencia && p.codigoAgencia === limpio)
      || pasajeros.find(p => p.dni && p.dni === limpio.replace(/\D/g, ''));

    // Si no está en caché, intentar por Firestore directo
    if (!encontrado) {
      try {
        const s = await getDoc(doc(db, 'operativos', opId, 'pasajeros', limpio));
        if (s.exists()) encontrado = { id: s.id, ...s.data() };
      } catch (_) {}
    }

    if (encontrado) {
      // Registrar check-in antes de mostrar éxito (transacción preserva creadoEn en re-escaneos)
      const checkinRef = doc(db, 'operativos', opId, 'checkins', encontrado.id);
      try {
        await runTransaction(db, async tx => {
          const snap = await tx.get(checkinRef);
          if (snap.exists()) {
            tx.update(checkinRef, { coordinadorId: refId, codigo: limpio, actualizadoEn: serverTimestamp() });
          } else {
            tx.set(checkinRef, { paxId: encontrado.id, coordinadorId: refId, codigo: limpio, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
          }
        });
        setResultado({ ok: true, pax: encontrado, codigo: limpio });
      } catch (e) {
        setResultado({ ok: true, pax: encontrado, codigo: limpio });
        setErrorCheckin('Check-in no registrado (sin conexión). Volvé a escanear cuando recuperes señal.');
      }
    } else {
      setResultado({ ok: false, pax: null, codigo: limpio });
    }
  }

  return (
    <div className="portal-section">
      {/* Video y canvas siempre en el DOM para que videoRef.current nunca sea null */}
      <div className="portal-qr-wrap" style={{ display: escaneando ? 'block' : 'none' }}>
        <video ref={videoRef} className="portal-qr-video" playsInline muted />
        <div className="portal-qr-overlay" />
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {escaneando && (
        <button className="portal-btn-secondary portal-qr-cancel" onClick={detener}>Cancelar</button>
      )}

      {!escaneando && !resultado && (
        <div className="portal-card">
          <div className="portal-card-header">Escáner QR</div>
          <div className="portal-info-text" style={{ marginBottom: 14 }}>
            Apuntá la cámara al código QR del pasajero para verificar sus datos.
          </div>
          {errorCam && <div className="portal-aviso-warning" style={{ marginBottom: 10 }}>{errorCam}</div>}
          <button className="portal-btn-primary" onClick={iniciar}>Abrir cámara</button>
        </div>
      )}

      {!escaneando && resultado && (
        <div className={`portal-card portal-qr-resultado ${resultado.ok ? 'ok' : 'nok'}`}>
          {resultado.ok ? (
            <>
              <div className="portal-qr-encontrado">✅ Pasajero encontrado</div>
              <div className="portal-qr-codigo">{resultado.codigo}</div>
              <FilaPaxDetalle pax={resultado.pax} />
              {errorCheckin && <div className="portal-aviso-warning" style={{ marginTop: 8 }}>{errorCheckin}</div>}
            </>
          ) : (
            <>
              <div className="portal-qr-noencontrado">❌ Código no registrado</div>
              <div className="portal-qr-codigo">{resultado.codigo}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                Este código no corresponde a ningún pasajero de este viaje.
              </div>
            </>
          )}
          <button className="portal-btn-secondary" style={{ marginTop: 12 }} onClick={() => { setResultado(null); iniciar(); }}>
            Escanear otro
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Filas ── */
function FilaPax({ pax }) {
  return (
    <div className="portal-pax-row">
      <div className="portal-pax-nombre">{pax.apellido ? `${pax.apellido}, ${pax.nombre}` : pax.nombre}</div>
      <div className="portal-pax-datos">
        {pax.dni && <span>DNI {pax.dni}</span>}
        {pax.hotel && <span>{pax.hotel}</span>}
        {pax.habitacion && <span>Hab. {pax.habitacion}</span>}
        {pax.colegio && <span>{pax.colegio}</span>}
      </div>
    </div>
  );
}

function FilaPaxDetalle({ pax }) {
  const filas = [
    ['Nombre', nombreCompleto(pax)],
    pax.dni && ['DNI', pax.dni],
    pax.hotel && ['Hotel', pax.hotel],
    pax.habitacion && ['Habitación', pax.habitacion],
    pax.asiento && ['Asiento', pax.asiento],
    pax.colegio && ['Colegio', pax.colegio],
  ].filter(Boolean);

  return (
    <div>
      {filas.map(([label, valor]) => (
        <div key={label} className="portal-dato-fila">
          <span className="portal-dato-label">{label}</span>
          <span className="portal-dato-valor">{valor}</span>
        </div>
      ))}
    </div>
  );
}
