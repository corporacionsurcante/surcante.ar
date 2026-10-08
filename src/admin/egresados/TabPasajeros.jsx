import React, { useMemo, useState } from 'react';
import {
  crearEnSub, actualizarEnSub, actualizarPasajerosMasivo, eliminarPasajerosMasivo,
} from '../../firebase/egresadosService';
import { Modal, Campo, Input, TextArea, BusChip, BotonEliminar, Vacio, useToast } from './ui';
import ImportarPasajeros from './ImportarPasajeros';
import {
  apellidoNombre, nombreCompleto, normalizarTexto, limpiarDni, distribuirPasajeros,
  descargarCSV, fechaCorta, edad,
} from './utils';

const VACIO = {
  apellido: '', nombre: '', dni: '', tipoDoc: 'DNI', fechaNacimiento: '', sexo: '', nacionalidad: 'Argentina',
  telefono: '', email: '', colegio: '', hotel: '', habitacion: '', busId: '', asiento: '', coordinadorId: '',
  emergenciaNombre: '', emergenciaTel: '', codigoAgencia: '', observaciones: '',
};

export default function TabPasajeros({ opId, op, buses, staff, pasajeros, accesos }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroBus, setFiltroBus] = useState('todos');
  const [filtroColegio, setFiltroColegio] = useState('todos');
  const [sel, setSel] = useState(() => new Set());
  const [editando, setEditando] = useState(null); // null | 'nuevo' | pasajero
  const [importar, setImportar] = useState(false);
  const [distribuir, setDistribuir] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [toast, mostrar] = useToast();

  const coordinadores = staff.filter(s => s.rol === 'coordinador');
  const busIds = useMemo(() => new Set(buses.map(b => b.id)), [buses]);
  const colegios = useMemo(() => [...new Set(pasajeros.map(p => p.colegio).filter(Boolean))].sort(), [pasajeros]);

  const dniRepetidos = useMemo(() => {
    const c = {};
    pasajeros.forEach(p => { if (p.dni) c[p.dni] = (c[p.dni] || 0) + 1; });
    return new Set(Object.keys(c).filter(k => c[k] > 1));
  }, [pasajeros]);

  const filtrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return pasajeros
      .filter(p => {
        if (filtroBus === 'sin' && p.busId && busIds.has(p.busId)) return false;
        if (filtroBus !== 'todos' && filtroBus !== 'sin' && p.busId !== filtroBus) return false;
        if (filtroColegio !== 'todos' && (p.colegio || '') !== filtroColegio) return false;
        if (!q) return true;
        return normalizarTexto([p.apellido, p.nombre, p.dni, p.colegio, p.hotel, p.telefono, p.codigoAgencia].join(' ')).includes(q);
      })
      .sort((a, b) => apellidoNombre(a).localeCompare(apellidoNombre(b), 'es'));
  }, [pasajeros, busqueda, filtroBus, filtroColegio, busIds]);

  const responsable = p => {
    if (p.coordinadorId) {
      const c = staff.find(s => s.id === p.coordinadorId);
      if (c) return { texto: nombreCompleto(c), propio: true };
    }
    const delBus = coordinadores.filter(c => p.busId && c.busId === p.busId);
    return { texto: delBus.map(nombreCompleto).join(', '), propio: false };
  };

  const todosSel = filtrados.length > 0 && filtrados.every(p => sel.has(p.id));
  function toggleTodos() {
    setSel(prev => {
      const n = new Set(prev);
      if (todosSel) filtrados.forEach(p => n.delete(p.id));
      else filtrados.forEach(p => n.add(p.id));
      return n;
    });
  }
  function toggle(id) {
    setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function asignarMasivo(campo, valor) {
    if (!sel.size) return;
    setTrabajando(true);
    await actualizarPasajerosMasivo(opId, [...sel].map(id => ({ id, data: { [campo]: valor || null } })));
    setTrabajando(false);
    mostrar(`✓ ${sel.size} pasajero${sel.size === 1 ? '' : 's'} actualizado${sel.size === 1 ? '' : 's'}`);
    setSel(new Set());
  }

  async function borrarMasivo() {
    const cantidad = sel.size;
    try {
      await eliminarPasajerosMasivo(opId, [...sel], accesos);
      mostrar(`🗑️ ${cantidad} pasajeros eliminados`);
      setSel(new Set());
    } catch (e) {
      console.error(e);
      mostrar('No se pudieron eliminar los pasajeros');
    }
  }

  function exportar() {
    const enc = ['Apellido', 'Nombre', 'Tipo doc', 'DNI', 'Fecha nac.', 'Edad', 'Sexo', 'Nacionalidad', 'Teléfono', 'Email', 'Colegio/Grupo', 'Hotel', 'Habitación', 'Ómnibus', 'Asiento', 'Coordinador responsable', 'Contacto emergencia', 'Tel. emergencia', 'Código agencia', 'Observaciones'];
    const filas = filtrados.map(p => {
      const bus = buses.find(b => b.id === p.busId);
      return [p.apellido, p.nombre, p.tipoDoc, p.dni, p.fechaNacimiento ? fechaCorta(p.fechaNacimiento) : '', edad(p.fechaNacimiento, op.fechaInicio) ?? '', p.sexo, p.nacionalidad, p.telefono, p.email, p.colegio, p.hotel, p.habitacion, bus?.codigo || '', p.asiento, responsable(p).texto, p.emergenciaNombre, p.emergenciaTel, p.codigoAgencia, p.observaciones];
    });
    descargarCSV(`Pasajeros ${op.nombre}.csv`, enc, filas);
  }

  const conteoBus = id => pasajeros.filter(p => p.busId === id).length;
  const sinBus = pasajeros.filter(p => !p.busId || !busIds.has(p.busId)).length;

  return (
    <>
      <div className="eg-head" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className={`eg-chip ${filtroBus === 'todos' ? 'eg-chip-purple' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setFiltroBus('todos')}>Todos · {pasajeros.length}</span>
          {buses.map(b => (
            <span key={b.id} style={{ cursor: 'pointer', opacity: filtroBus === 'todos' || filtroBus === b.id ? 1 : 0.45 }} onClick={() => setFiltroBus(b.id)}>
              <BusChip bus={{ ...b, codigo: `${b.codigo} · ${conteoBus(b.id)}/${b.capacidad || 0}` }} />
            </span>
          ))}
          {sinBus > 0 && <span className="eg-chip eg-chip-amber" style={{ cursor: 'pointer' }} onClick={() => setFiltroBus('sin')}>Sin asignar · {sinBus}</span>}
        </div>
        <div className="eg-actions">
          <button className="eg-btn eg-btn-soft" onClick={() => setImportar(true)}>📥 Importar Excel</button>
          <button className="eg-btn eg-btn-soft" onClick={() => setDistribuir(true)} disabled={!buses.length || !pasajeros.length}>🔀 Distribuir en ómnibus</button>
          <button className="eg-btn eg-btn-ghost" onClick={exportar} disabled={!filtrados.length}>⬇️ Exportar</button>
          <button className="eg-btn eg-btn-primary" onClick={() => setEditando('nuevo')}>+ Pasajero</button>
        </div>
      </div>

      {pasajeros.length === 0 ? (
        <div className="eg-section">
          <Vacio icono="🎒">
            Todavía no hay pasajeros.<br />La forma más rápida es importar el Excel que manda la agencia.<br />
            <button className="eg-btn eg-btn-primary" style={{ marginTop: 14 }} onClick={() => setImportar(true)}>📥 Importar Excel / CSV</button>
          </Vacio>
        </div>
      ) : (
        <>
          <div className="eg-toolbar">
            <input className="eg-input" placeholder="🔍 Buscar por nombre, DNI, colegio, hotel..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <select className="eg-input" value={filtroBus} onChange={e => setFiltroBus(e.target.value)}>
              <option value="todos">Todos los ómnibus</option>
              <option value="sin">Sin asignar</option>
              {buses.map(b => <option key={b.id} value={b.id}>{b.codigo}</option>)}
            </select>
            {colegios.length > 1 && (
              <select className="eg-input" value={filtroColegio} onChange={e => setFiltroColegio(e.target.value)}>
                <option value="todos">Todos los grupos</option>
                {colegios.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div className="eg-table-wrap" style={{ maxHeight: '65vh' }}>
            <table className="eg-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={todosSel} onChange={toggleTodos} /></th>
                  <th>Pasajero</th><th>DNI</th><th>Colegio / grupo</th><th>Hotel</th><th>Ómnibus</th><th>Responsable</th><th>Teléfono</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const bus = buses.find(b => b.id === p.busId);
                  const resp = responsable(p);
                  return (
                    <tr key={p.id} className={sel.has(p.id) ? 'sel' : ''}>
                      <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{apellidoNombre(p)}</div>
                        {p.observaciones && <div className="muted" style={{ fontSize: 11 }} title={p.observaciones}>📝 {p.observaciones.slice(0, 40)}{p.observaciones.length > 40 ? '…' : ''}</div>}
                      </td>
                      <td>{p.dni ? <span style={{ color: dniRepetidos.has(p.dni) ? '#CF1322' : undefined, fontWeight: dniRepetidos.has(p.dni) ? 800 : 500 }}>{p.dni}{dniRepetidos.has(p.dni) ? ' ⚠️' : ''}</span> : <span className="eg-chip eg-chip-amber">Falta</span>}</td>
                      <td className="muted">{p.colegio || '—'}</td>
                      <td className="muted">{[p.hotel, p.habitacion && `hab. ${p.habitacion}`].filter(Boolean).join(' · ') || '—'}</td>
                      <td><BusChip bus={bus} /></td>
                      <td className={resp.propio ? '' : 'muted'} style={{ fontStyle: resp.propio ? 'normal' : 'italic' }}>{resp.texto || '—'}</td>
                      <td className="muted">{p.telefono || '—'}</td>
                      <td><button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => setEditando(p)}>✏️</button></td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin resultados para ese filtro.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="eg-sub" style={{ marginTop: 6 }}>Mostrando {filtrados.length} de {pasajeros.length}. El responsable en gris es el coordinador del ómnibus (por defecto).</div>
        </>
      )}

      {sel.size > 0 && (
        <div className="eg-bulkbar">
          <b style={{ fontSize: 13 }}>{sel.size} seleccionado{sel.size === 1 ? '' : 's'}</b>
          <select disabled={trabajando} value="" onChange={e => e.target.value && asignarMasivo('busId', e.target.value === '__none' ? null : e.target.value)}>
            <option value="">🚌 Asignar a ómnibus…</option>
            {buses.map(b => <option key={b.id} value={b.id}>{b.codigo} ({conteoBus(b.id)}/{b.capacidad || 0})</option>)}
            <option value="__none">— Quitar ómnibus —</option>
          </select>
          <select disabled={trabajando} value="" onChange={e => e.target.value && asignarMasivo('coordinadorId', e.target.value === '__none' ? null : e.target.value)}>
            <option value="">📋 Coordinador responsable…</option>
            {coordinadores.map(c => <option key={c.id} value={c.id}>{nombreCompleto(c)}</option>)}
            <option value="__none">— El del ómnibus (por defecto) —</option>
          </select>
          <button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => setSel(new Set())}>Cancelar</button>
          <div style={{ marginLeft: 'auto' }}>
            <BotonEliminar small texto="Eliminar" confirmar={`Sí, eliminar ${sel.size}`} onConfirm={borrarMasivo} />
          </div>
        </div>
      )}

      {editando && (
        <PasajeroForm opId={opId} pasajero={editando === 'nuevo' ? null : editando} buses={buses} coordinadores={coordinadores}
          pasajeros={pasajeros} accesos={accesos} onClose={() => setEditando(null)} />
      )}
      {importar && (
        <ImportarPasajeros opId={opId} buses={buses} staff={staff} pasajeros={pasajeros}
          onClose={() => setImportar(false)} onListo={n => mostrar(`✓ ${n} pasajeros importados`)} />
      )}
      {distribuir && (
        <DistribuirModal opId={opId} buses={buses} staff={staff} pasajeros={pasajeros}
          onClose={() => setDistribuir(false)} onListo={n => mostrar(`✓ ${n} pasajeros asignados`)} />
      )}
      {toast}
    </>
  );
}

function PasajeroForm({ opId, pasajero, buses, coordinadores, pasajeros, accesos, onClose }) {
  const [form, setForm] = useState(() => ({ ...VACIO, ...(pasajero || {}), busId: pasajero?.busId || '', coordinadorId: pasajero?.coordinadorId || '' }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    if (!form.apellido.trim() && !form.nombre.trim()) { setError('Completá nombre y apellido.'); return; }
    const dni = limpiarDni(form.dni);
    const dup = dni && pasajeros.find(p => p.dni === dni && p.id !== pasajero?.id);
    if (dup) { setError(`Ya existe un pasajero con DNI ${dni}: ${apellidoNombre(dup)}.`); return; }
    setGuardando(true);
    const data = {};
    Object.keys(VACIO).forEach(k => { data[k] = typeof form[k] === 'string' ? form[k].trim() : (form[k] ?? ''); });
    data.dni = dni;
    data.busId = form.busId || null;
    data.coordinadorId = form.coordinadorId || null;
    try {
      if (pasajero?.id) await actualizarEnSub(opId, 'pasajeros', pasajero.id, data);
      else await crearEnSub(opId, 'pasajeros', data);
      onClose();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar.');
      setGuardando(false);
    }
  }

  const F = { form, set: setForm };
  return (
    <Modal
      titulo={pasajero ? apellidoNombre(pasajero) : 'Nuevo pasajero'}
      onClose={onClose}
      footer={<>
        {pasajero && (
          <div style={{ marginRight: 'auto' }}>
            <BotonEliminar small texto="Eliminar" confirmar="Sí, eliminar"
              onConfirm={async () => { await eliminarPasajerosMasivo(opId, [pasajero.id], accesos); onClose(); }} />
          </div>
        )}
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Guardar'}</button>
      </>}>
      <div className="eg-form-grid">
        <div className="eg-form-section full">Datos personales</div>
        <Campo label="Apellido"><Input {...F} campo="apellido" autoFocus /></Campo>
        <Campo label="Nombre"><Input {...F} campo="nombre" /></Campo>
        <Campo label="Tipo doc."><Input {...F} campo="tipoDoc" /></Campo>
        <Campo label="N° documento"><Input {...F} campo="dni" inputMode="numeric" /></Campo>
        <Campo label="Fecha de nacimiento"><Input {...F} campo="fechaNacimiento" type="date" /></Campo>
        <Campo label="Sexo">
          <select value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
            <option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">X</option>
          </select>
        </Campo>
        <Campo label="Nacionalidad"><Input {...F} campo="nacionalidad" /></Campo>
        <Campo label="Teléfono / WhatsApp"><Input {...F} campo="telefono" type="tel" /></Campo>
        <Campo label="Email" full><Input {...F} campo="email" type="email" /></Campo>

        <div className="eg-form-section full">Viaje</div>
        <Campo label="Colegio / grupo"><Input {...F} campo="colegio" /></Campo>
        <Campo label="Código de la agencia" hint="El que figura en su QR o voucher"><Input {...F} campo="codigoAgencia" /></Campo>
        <Campo label="Hotel"><Input {...F} campo="hotel" /></Campo>
        <Campo label="Habitación"><Input {...F} campo="habitacion" /></Campo>
        <Campo label="Ómnibus">
          <select value={form.busId} onChange={e => setForm(f => ({ ...f, busId: e.target.value }))}>
            <option value="">— Sin asignar —</option>
            {buses.map(b => <option key={b.id} value={b.id}>{b.codigo}</option>)}
          </select>
        </Campo>
        <Campo label="Asiento"><Input {...F} campo="asiento" /></Campo>
        <Campo label="Coordinador responsable" full>
          <select value={form.coordinadorId} onChange={e => setForm(f => ({ ...f, coordinadorId: e.target.value }))}>
            <option value="">— El del ómnibus (por defecto) —</option>
            {coordinadores.map(c => <option key={c.id} value={c.id}>{nombreCompleto(c)}</option>)}
          </select>
        </Campo>

        <div className="eg-form-section full">Emergencias y observaciones</div>
        <Campo label="Contacto de emergencia"><Input {...F} campo="emergenciaNombre" placeholder="Madre, padre o tutor" /></Campo>
        <Campo label="Teléfono de emergencia"><Input {...F} campo="emergenciaTel" type="tel" /></Campo>
        <Campo label="Observaciones" full hint="Dieta, medicación, cuidados especiales. Lo ven el coordinador y el admin.">
          <TextArea {...F} campo="observaciones" rows={2} />
        </Campo>
      </div>
      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

function DistribuirModal({ opId, buses, staff, pasajeros, onClose, onListo }) {
  const [soloSinAsignar, setSoloSinAsignar] = useState(true);
  const [agrupar, setAgrupar] = useState(true);
  const [aplicando, setAplicando] = useState(false);

  const plan = useMemo(
    () => distribuirPasajeros({ pasajeros, buses, staff, soloSinAsignar, agrupar }),
    [pasajeros, buses, staff, soloSinAsignar, agrupar],
  );

  async function aplicar() {
    setAplicando(true);
    await actualizarPasajerosMasivo(opId, plan.cambios.map(c => ({ id: c.id, data: { busId: c.busId } })));
    onListo(plan.cambios.length);
    onClose();
  }

  const finalPorBus = b => {
    const antes = soloSinAsignar ? pasajeros.filter(p => p.busId === b.id).length : 0;
    return antes + (plan.resumen[b.id] || 0);
  };

  return (
    <Modal titulo="Distribuir pasajeros en ómnibus" onClose={onClose}
      footer={<>
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={aplicar} disabled={aplicando || !plan.cambios.length}>
          {aplicando ? 'Aplicando...' : `✓ Asignar ${plan.cambios.length} pasajeros`}
        </button>
      </>}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        <input type="checkbox" checked={soloSinAsignar} onChange={e => setSoloSinAsignar(e.target.checked)} />
        Solo los que no tienen ómnibus (respeta lo ya asignado)
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
        <input type="checkbox" checked={agrupar} onChange={e => setAgrupar(e.target.checked)} />
        Mantener juntos a los del mismo colegio / grupo
      </label>
      <div className="eg-sub" style={{ marginBottom: 10 }}>Se descuenta una butaca por cada coordinador asignado al ómnibus.</div>
      <div className="eg-table-wrap">
        <table className="eg-table">
          <thead><tr><th>Ómnibus</th><th>Nuevos</th><th>Total pasajeros</th><th>Capacidad</th></tr></thead>
          <tbody>
            {buses.map(b => (
              <tr key={b.id}>
                <td><BusChip bus={b} /></td>
                <td><b>+{plan.resumen[b.id] || 0}</b></td>
                <td>{finalPorBus(b)}</td>
                <td className="muted">{b.capacidad || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plan.sinLugar > 0 && <div className="eg-alert eg-alert-error" style={{ marginTop: 10 }}>⛔ {plan.sinLugar} pasajeros no entran: faltan butacas. Agregá otro ómnibus o aumentá capacidades.</div>}
      {!plan.cambios.length && !plan.sinLugar && <div className="eg-alert eg-alert-ok" style={{ marginTop: 10 }}>No hay pasajeros para asignar.</div>}
    </Modal>
  );
}
