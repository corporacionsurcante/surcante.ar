import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, getDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { colorBus, labelFecha, hoyISO, nombreCompleto, linkWhatsApp } from '../admin/egresados/utils';

const QR_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

/** Devuelve true si la actividad es visible para un pasajero/usuario con el busId dado.
 *  Una actividad sin buses asignados (array vacío o ausente) es visible para todos los buses.
 */
function actividadParaBus(act, busId) {
  if (!busId) return true;                         // sin bus asignado → se ven todas
  if (!act.buses?.length) return true;             // actividad para todos los buses
  return act.buses.includes(busId);
}

function cargarQRCode() {
  if (window.QRCode) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = QR_CDN;
    s.onload = res;
    s.onerror = () => rej(new Error('No se pudo cargar el generador QR'));
    document.head.appendChild(s);
  });
}

function QRDisplay({ value, size = 180 }) {
  const ref = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!value || !ref.current) return;
    let cancelled = false;
    cargarQRCode().then(() => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = '';
      new window.QRCode(ref.current, {
        text: value, width: size, height: size,
        colorDark: '#1a1a2e', colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    }).catch(e => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [value, size]);
  if (err) return <div style={{ fontSize: 12, color: '#cf1322' }}>{err}</div>;
  return <div ref={ref} style={{ lineHeight: 0 }} />;
}

export default function PortalPasajero({ sesion }) {
  const { opId, refId, busId } = sesion;
  const hoy = useMemo(() => hoyISO(), []);
  const [tab, setTab] = useState('hoy');
  const [op, setOp] = useState(null);
  const [pax, setPax] = useState(null);
  const [bus, setBus] = useState(null);
  const [staff, setStaff] = useState([]);
  const [itinerario, setItinerario] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [abiertos, setAbiertos] = useState({ [hoy]: true });

  useEffect(() => {
    getDoc(doc(db, 'operativos', opId))
      .then(s => s.exists() && setOp({ id: s.id, ...s.data() }));
    getDoc(doc(db, 'operativos', opId, 'pasajeros', refId))
      .then(s => s.exists() && setPax({ id: s.id, ...s.data() }));
    if (busId) {
      getDoc(doc(db, 'operativos', opId, 'buses', busId))
        .then(s => s.exists() && setBus({ id: s.id, ...s.data() }));
    }
    getDocs(collection(db, 'operativos', opId, 'staff'))
      .then(snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(collection(db, 'operativos', opId, 'itinerario'))
      .then(snap => {
        setItinerario(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)));
      });
    return onSnapshot(collection(db, 'operativos', opId, 'avisos'), snap =>
      setAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0)))
    );
  }, [opId, refId, busId]);

  const conductor = staff.find(s => s.rol === 'conductor' && s.busId === busId);
  const coordinador = staff.find(s => s.rol === 'coordinador' && s.busId === busId);
  const busColor = colorBus(bus);
  const diaHoy = itinerario.find(d => d.id === hoy);

  return (
    <div className="portal-wrap">
      <header className="portal-header">
        <span className="portal-header-logo">🎒</span>
        <div>
          <div className="portal-header-title">{op?.nombre || 'Mi viaje'}</div>
          <div className="portal-header-sub">{sesion.nombre || 'Pasajero'}</div>
        </div>
        {bus && (
          <div className="portal-bus-badge" style={{ background: busColor }}>
            {bus.codigo || 'Bus'}
          </div>
        )}
      </header>

      <nav className="portal-tabs">
        {[['hoy', 'Hoy'], ['bus', 'Mi bus'], ['agenda', 'Agenda'], ['yo', 'Yo']].map(([id, label]) => (
          <button key={id} className={`portal-tab${tab === id ? ' activo' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="portal-main">
        {tab === 'hoy'    && <TabHoy dia={diaHoy} avisos={avisos} fecha={hoy} rol="pasajero" busId={busId} />}
        {tab === 'bus'    && <TabBus bus={bus} conductor={conductor} coordinador={coordinador} busColor={busColor} />}
        {tab === 'agenda' && <TabAgenda itinerario={itinerario} hoy={hoy} abiertos={abiertos} setAbiertos={setAbiertos} busId={busId} />}
        {tab === 'yo'     && <TabYo pax={pax} />}
      </main>
    </div>
  );
}

/* ── Hoy ── */
function TabHoy({ dia, avisos, fecha, rol, busId }) {
  const actividades = (dia?.actividades || []).filter(a =>
    (rol !== 'pasajero' || !a.soloStaff) && actividadParaBus(a, busId)
  );
  return (
    <div className="portal-section">
      <div className="portal-card-label">{labelFecha(fecha, { largo: true })}</div>

      {actividades.length === 0 && (
        <div className="portal-card">
          <p style={{ fontSize: 13, color: '#b0b0c8', margin: 0 }}>Sin actividades registradas para hoy.</p>
        </div>
      )}
      {actividades.map((act, i) => (
        <div key={i} className="portal-actividad">
          <div className="portal-act-hora">{act.hora || '—'}</div>
          <div>
            <div className="portal-act-titulo">{act.titulo}</div>
            {(act.paraPasajeros || act.nota) && <div className="portal-act-nota">{act.paraPasajeros || act.nota}</div>}
            {rol === 'conductor' && (act.paraConductores || act.notaConductor) && (
              <div className="portal-act-nota nota-conductor">🧑‍✈️ {act.paraConductores || act.notaConductor}</div>
            )}
            {rol === 'coordinador' && (act.paraCoordinadores || act.notaCoord) && (
              <div className="portal-act-nota nota-coord">📋 {act.paraCoordinadores || act.notaCoord}</div>
            )}
          </div>
        </div>
      ))}

      {dia?.notaGeneral && (
        <div className="portal-card portal-info-general">
          <p>{dia.notaGeneral}</p>
        </div>
      )}

      {avisos.length > 0 && (
        <>
          <div className="portal-card-label" style={{ marginTop: 6 }}>Avisos</div>
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
        </>
      )}
    </div>
  );
}

/* ── Mi bus ── */
function TabBus({ bus, conductor, coordinador, busColor }) {
  if (!bus) return (
    <div className="portal-section">
      <div className="portal-card">
        <p style={{ fontSize: 13, color: '#b0b0c8', margin: 0 }}>
          Todavía no tenés un ómnibus asignado. Consultá a tu agencia.
        </p>
      </div>
    </div>
  );

  return (
    <div className="portal-section">
      <div className="portal-card">
        <div className="portal-card-header">Tu ómnibus</div>
        <div className="portal-bus-nombre">{bus.nombre || bus.codigo || 'Ómnibus'}</div>
        {(bus.interno || bus.patente) && (
          <div className="portal-bus-meta">
            {bus.interno && `Interno ${bus.interno}`}
            {bus.interno && bus.patente && ' · '}
            {bus.patente}
          </div>
        )}
        {bus.color && (
          <div style={{ marginTop: 10 }}>
            <span className="portal-chip" style={{ color: busColor, borderColor: busColor }}>
              {bus.codigo || bus.color}
            </span>
          </div>
        )}
        {bus.marca && <div className="portal-bus-meta" style={{ marginTop: 6 }}>{bus.marca} {bus.modelo}</div>}
      </div>

      {conductor && <ContactCard titulo="Conductor" persona={conductor} />}
      {coordinador && <ContactCard titulo="Coordinador/a" persona={coordinador} />}

      {!conductor && !coordinador && (
        <div className="portal-aviso-warning">
          Los datos del conductor y coordinador se van a ver acá una vez que el viaje esté confirmado.
        </div>
      )}
    </div>
  );
}

function ContactCard({ titulo, persona }) {
  const nombre = nombreCompleto(persona);
  const wa = persona.telefono ? linkWhatsApp(persona.telefono, `Hola ${persona.nombre || ''}, te escribo por el viaje de egresados.`) : null;
  return (
    <div className="portal-card">
      <div className="portal-card-header">{titulo}</div>
      <div className="portal-contact-nombre">{nombre || '—'}</div>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="portal-contact-tel">
          <span>📞</span> {persona.telefono}
        </a>
      ) : persona.telefono ? (
        <div className="portal-contact-tel" style={{ color: '#555' }}>📞 {persona.telefono}</div>
      ) : null}
    </div>
  );
}

/* ── Agenda ── */
function TabAgenda({ itinerario, hoy, abiertos, setAbiertos, busId }) {
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
        const actividades = (dia.actividades || []).filter(a =>
          !a.soloStaff && actividadParaBus(a, busId)
        );
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
                      </div>
                    </div>
                  ))
                }
                {dia.notaGeneral && <div className="portal-info-text">{dia.notaGeneral}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Yo ── */
function TabYo({ pax }) {
  const [fullscreenQR, setFullscreenQR] = useState(false);
  const overlayRef = useRef(null);
  useEffect(() => {
    if (fullscreenQR) overlayRef.current?.focus();
  }, [fullscreenQR]);

  if (!pax) return (
    <div className="portal-section">
      <div className="portal-card">
        <p style={{ fontSize: 13, color: '#b0b0c8', margin: 0 }}>Cargando tus datos…</p>
      </div>
    </div>
  );

  const codigoQR = pax.id || pax.codigoAgencia || pax.dni || null;

  const filas = [
    ['Nombre', nombreCompleto(pax) || '—'],
    ['DNI', pax.dni || '—'],
    pax.fechaNacimiento && ['Fecha de nac.', pax.fechaNacimiento.split('-').reverse().join('/')],
    pax.hotel && ['Hotel', pax.hotel],
    pax.habitacion && ['Habitación', pax.habitacion],
    pax.asiento && ['Asiento', pax.asiento],
    pax.colegio && ['Colegio', pax.colegio],
  ].filter(Boolean);

  return (
    <div className="portal-section">
      {codigoQR && (
        <div className="portal-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="portal-card-header">Mi código QR</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 }}>
            <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #e0d4f7' }}>
              <QRDisplay value={codigoQR} size={180} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#7b2fbe', letterSpacing: '.04em' }}>{codigoQR}</div>
            <div style={{ fontSize: 12, color: '#b0b0c8', lineHeight: 1.5 }}>
              Mostrá este QR al coordinador para el check-in
            </div>
            <button
              className="portal-btn-secondary"
              style={{ fontSize: 13, padding: '8px 18px' }}
              onClick={() => setFullscreenQR(true)}
            >
              🔍 Ampliar QR
            </button>
          </div>
        </div>
      )}

      <div className="portal-card">
        <div className="portal-card-header">Mis datos</div>
        {filas.map(([label, valor]) => (
          <div key={label} className="portal-dato-fila">
            <span className="portal-dato-label">{label}</span>
            <span className="portal-dato-valor">{valor}</span>
          </div>
        ))}
      </div>

      {(pax.emergenciaNombre || pax.emergenciaTel) && (
        <div className="portal-card">
          <div className="portal-card-header">Contacto de emergencia</div>
          {pax.emergenciaNombre && (
            <div className="portal-dato-fila">
              <span className="portal-dato-label">Nombre</span>
              <span className="portal-dato-valor">{pax.emergenciaNombre}</span>
            </div>
          )}
          {pax.emergenciaTel && (
            <div className="portal-dato-fila">
              <span className="portal-dato-label">Teléfono</span>
              <a href={linkWhatsApp(pax.emergenciaTel)} target="_blank" rel="noopener noreferrer" className="portal-contact-tel" style={{ marginLeft: 'auto' }}>
                {pax.emergenciaTel}
              </a>
            </div>
          )}
        </div>
      )}

      {pax.observaciones && (
        <div className="portal-card portal-info-general">
          <div className="portal-card-header">Observaciones</div>
          <p>{pax.observaciones}</p>
        </div>
      )}

      {fullscreenQR && codigoQR && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="QR ampliado"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, outline: 'none' }}
          onClick={() => setFullscreenQR(false)}
          onKeyDown={e => e.key === 'Escape' && setFullscreenQR(false)}
          tabIndex={-1}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 20 }} onClick={e => e.stopPropagation()}>
            <QRDisplay value={codigoQR} size={260} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '.06em' }}>{codigoQR}</div>
          <button
            onClick={() => setFullscreenQR(false)}
            style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
