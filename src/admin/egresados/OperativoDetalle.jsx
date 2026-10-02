import React, { useEffect, useMemo, useState } from 'react';
import {
  suscribirOperativo, suscribirSub, suscribirAccesos, suscribirConductores,
  actualizarOperativo, eliminarOperativo,
} from '../../firebase/egresadosService';
import { suscribirUnidades } from '../../firebase/ganttServices';
import OperativoForm from './OperativoForm';
import TabResumen from './TabResumen';
import TabBuses from './TabBuses';
import TabPersonal from './TabPersonal';
import TabPasajeros from './TabPasajeros';
import TabItinerario from './TabItinerario';
import TabAccesos from './TabAccesos';
import ImportarMaestro from './ImportarMaestro';
import { BotonEliminar, AvisoPermisos } from './ui';
import { ESTADOS_OPERATIVO, fechaCorta, ordenarBuses } from './utils';

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: '📊' },
  { id: 'buses', label: 'Ómnibus', icon: '🚌' },
  { id: 'personal', label: 'Conductores y coordinadores', icon: '🧑‍✈️' },
  { id: 'pasajeros', label: 'Pasajeros', icon: '🎒' },
  { id: 'itinerario', label: 'Diagrama día a día', icon: '🗓️' },
  { id: 'accesos', label: 'Links de acceso', icon: '🔗' },
];

const TAB_KEY = 'surcante_egresados_tab';

export default function OperativoDetalle({ opId, agencia, onVolverAgencias, onVolverAgencia, onEliminado }) {
  const [op, setOp] = useState(undefined);
  const [buses, setBuses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pasajeros, setPasajeros] = useState([]);
  const [itinerario, setItinerario] = useState([]);
  const [accesos, setAccesos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [padronConductores, setPadronConductores] = useState([]);
  const [tab, setTabState] = useState(() => {
    try { return window.sessionStorage.getItem(TAB_KEY) || 'resumen'; } catch (_) { return 'resumen'; }
  });
  const [editar, setEditar] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorPermisos, setErrorPermisos] = useState('');

  useEffect(() => {
    const onError = e => { console.error(e); setErrorPermisos(e?.code || e?.message || 'error'); };
    const subs = [
      suscribirOperativo(opId, setOp, onError),
      suscribirSub(opId, 'buses', setBuses, onError),
      suscribirSub(opId, 'staff', setStaff, onError),
      suscribirSub(opId, 'pasajeros', setPasajeros, onError),
      suscribirSub(opId, 'itinerario', setItinerario, onError),
      suscribirAccesos(opId, setAccesos, onError),
      suscribirUnidades(setUnidades),
      suscribirConductores(setPadronConductores, onError),
    ];
    return () => subs.forEach(u => u());
  }, [opId]);

  function setTab(t) {
    setTabState(t);
    try { window.sessionStorage.setItem(TAB_KEY, t); } catch (_) { /* noop */ }
  }

  const busesOrdenados = useMemo(() => ordenarBuses(buses), [buses]);

  if (errorPermisos) return <AvisoPermisos codigo={errorPermisos} />;
  if (op === undefined) return <div className="admin-loading">Cargando operativo...</div>;
  if (op === null) {
    return (
      <div className="eg-section">
        <div className="eg-alert eg-alert-warn">Este operativo ya no existe.</div>
        <button className="eg-btn eg-btn-ghost" onClick={onVolverAgencia}>← Volver</button>
      </div>
    );
  }

  const ctx = {
    op, opId, agencia,
    buses: busesOrdenados, staff, pasajeros, itinerario, accesos, unidades, padronConductores,
    irA: setTab,
  };

  const counts = {
    buses: buses.length,
    personal: staff.length,
    pasajeros: pasajeros.length,
    itinerario: itinerario.length,
    accesos: accesos.length,
  };

  return (
    <>
      <div className="eg-breadcrumb">
        <button onClick={onVolverAgencias}>Agencias</button> <span>›</span>
        <button onClick={onVolverAgencia}>{agencia?.nombre || op.agenciaNombre || 'Agencia'}</button> <span>›</span>
        <span>{op.nombre}</span>
      </div>

      <div className="eg-head">
        <div>
          <div className="eg-title">{op.nombre}</div>
          <div className="eg-sub">
            {[op.destino && `📍 ${op.destino}`, `📅 ${fechaCorta(op.fechaInicio)} → ${fechaCorta(op.fechaFin)}`, op.colegios && `🏫 ${op.colegios}`].filter(Boolean).join('   ·   ')}
          </div>
        </div>
        <div className="eg-actions">
          <select
            className="eg-input"
            style={{ width: 'auto', padding: '8px 10px', fontSize: 12.5, fontWeight: 700 }}
            value={op.estado || 'planificacion'}
            onChange={e => actualizarOperativo(opId, { estado: e.target.value })}>
            {Object.entries(ESTADOS_OPERATIVO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="eg-btn eg-btn-soft" onClick={() => setImportando(true)}>📥 Importar Excel</button>
          <button className="eg-btn eg-btn-ghost" onClick={() => setEditar(true)}>✏️ Datos del viaje</button>
        </div>
      </div>

      <div className="eg-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`eg-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>{t.label}
            {counts[t.id] > 0 && <span className="count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <TabResumen {...ctx} onEditar={() => setEditar(true)} />}
      {tab === 'buses' && <TabBuses {...ctx} />}
      {tab === 'personal' && <TabPersonal {...ctx} />}
      {tab === 'pasajeros' && <TabPasajeros {...ctx} />}
      {tab === 'itinerario' && <TabItinerario {...ctx} />}
      {tab === 'accesos' && <TabAccesos {...ctx} />}

      {tab === 'resumen' && (
        <div style={{ marginTop: 28 }}>
          <BotonEliminar
            texto="Eliminar operativo"
            confirmar="Sí, borrar todo (pasajeros, buses, links)"
            small
            onConfirm={async () => { await eliminarOperativo(opId); onEliminado(); }}
          />
        </div>
      )}

      {editar && <OperativoForm agencia={agencia} operativo={op} onClose={() => setEditar(false)} />}
      {importando && (
        <ImportarMaestro
          opId={opId}
          buses={busesOrdenados}
          staff={staff}
          pasajeros={pasajeros}
          onClose={() => setImportando(false)}
        />
      )}
    </>
  );
}
