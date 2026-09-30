import React, { useState } from 'react';
import { crearEnSub, actualizarEnSub, eliminarStaff, upsertConductor } from '../../firebase/egresadosService';
import { Modal, Campo, Input, TextArea, BusChip, BotonEliminar, Vacio } from './ui';
import { nombreCompleto, fechaCorta, limpiarDni, linkWhatsApp, ROLES } from './utils';

const VACIO = {
  nombre: '', apellido: '', dni: '', telefono: '', email: '', busId: '',
  licencia: '', vencLicencia: '', grupo: '', notas: '',
};

export default function TabPersonal({ opId, op, buses, staff, pasajeros, accesos, padronConductores }) {
  const [editando, setEditando] = useState(null); // { rol, persona? }

  return (
    <>
      <div className="eg-sub" style={{ marginBottom: 14 }}>
        Asigná cada persona a su ómnibus. Los conductores se guardan en un padrón para reutilizarlos en otros operativos.
      </div>
      {['conductor', 'coordinador'].map(rol => (
        <Seccion
          key={rol}
          rol={rol}
          lista={staff.filter(s => s.rol === rol)}
          buses={buses}
          pasajeros={pasajeros}
          op={op}
          fin={op.fechaFin || op.fechaInicio}
          onNuevo={() => setEditando({ rol })}
          onEditar={p => setEditando({ rol, persona: p })}
        />
      ))}
      {editando && (
        <PersonaForm
          opId={opId}
          rol={editando.rol}
          persona={editando.persona}
          buses={buses}
          pasajeros={pasajeros}
          accesos={accesos}
          padronConductores={padronConductores}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  );
}

function Seccion({ rol, lista, buses, pasajeros, fin, onNuevo, onEditar }) {
  const R = ROLES[rol];
  const ordenada = [...lista].sort((a, b) => {
    const ba = buses.findIndex(x => x.id === a.busId);
    const bb = buses.findIndex(x => x.id === b.busId);
    return (ba < 0 ? 999 : ba) - (bb < 0 ? 999 : bb) || nombreCompleto(a).localeCompare(nombreCompleto(b));
  });
  return (
    <div className="eg-section">
      <div className="eg-section-title">
        <span>{R.icon} {R.plural} ({lista.length})</span>
        <button className="eg-btn eg-btn-primary eg-btn-sm" onClick={onNuevo}>+ Agregar {R.label.toLowerCase()}</button>
      </div>
      {lista.length === 0 ? <Vacio icono={R.icon}>Sin {R.plural.toLowerCase()} cargados.</Vacio> : (
        <div className="eg-table-wrap" style={{ border: 'none' }}>
          <table className="eg-table">
            <thead>
              <tr>
                <th>Nombre</th><th>DNI</th><th>Teléfono</th><th>Ómnibus</th>
                {rol === 'conductor' ? <><th>Licencia</th><th>Vence</th></> : <><th>Grupo a cargo</th><th>Pasajeros a cargo</th></>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenada.map(p => {
                const bus = buses.find(b => b.id === p.busId);
                const vencida = p.vencLicencia && fin && p.vencLicencia <= fin;
                const aCargo = pasajeros.filter(x => x.coordinadorId === p.id || (!x.coordinadorId && x.busId && x.busId === p.busId)).length;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{nombreCompleto(p)}</td>
                    <td className="muted">{p.dni || '—'}</td>
                    <td>
                      {p.telefono
                        ? <a href={linkWhatsApp(p.telefono, `Hola ${p.nombre}!`)} target="_blank" rel="noreferrer" style={{ color: '#128C4B', fontWeight: 700, textDecoration: 'none' }}>📱 {p.telefono}</a>
                        : <span className="eg-chip eg-chip-amber">Sin teléfono</span>}
                    </td>
                    <td><BusChip bus={bus} /></td>
                    {rol === 'conductor'
                      ? <><td className="muted">{p.licencia || '—'}</td><td style={{ color: vencida ? '#CF1322' : undefined, fontWeight: vencida ? 800 : 500 }}>{p.vencLicencia ? fechaCorta(p.vencLicencia) : '—'}</td></>
                      : <><td className="muted">{p.grupo || '—'}</td><td>{aCargo}</td></>}
                    <td><button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => onEditar(p)}>✏️</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PersonaForm({ opId, rol, persona, buses, pasajeros, accesos, padronConductores, onClose }) {
  const [form, setForm] = useState(() => ({ ...VACIO, ...(persona || {}), busId: persona?.busId || '' }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const R = ROLES[rol];

  function cargarDePadron(id) {
    const c = padronConductores.find(x => x.id === id);
    if (!c) return;
    setForm(f => ({ ...f, nombre: c.nombre || '', apellido: c.apellido || '', dni: c.dni || '', telefono: c.telefono || '', licencia: c.licencia || '', vencLicencia: c.vencLicencia || '' }));
  }

  async function guardar() {
    if (!form.nombre.trim() && !form.apellido.trim()) { setError('Completá nombre y apellido.'); return; }
    setGuardando(true);
    const t = v => String(v ?? '').trim();
    const data = {
      rol,
      nombre: t(form.nombre), apellido: t(form.apellido), dni: limpiarDni(form.dni),
      telefono: t(form.telefono), email: t(form.email).toLowerCase(),
      busId: form.busId || null, notas: t(form.notas),
      ...(rol === 'conductor'
        ? { licencia: t(form.licencia), vencLicencia: form.vencLicencia || '' }
        : { grupo: t(form.grupo) }),
    };
    try {
      if (persona?.id) await actualizarEnSub(opId, 'staff', persona.id, data);
      else await crearEnSub(opId, 'staff', data);
      if (rol === 'conductor') await upsertConductor(data);
      onClose();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar.');
      setGuardando(false);
    }
  }

  const F = { form, set: setForm };
  const padronOrdenado = [...padronConductores].sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));

  return (
    <Modal
      titulo={persona ? `Editar ${nombreCompleto(persona)}` : `Nuevo ${R.label.toLowerCase()}`}
      onClose={onClose}
      footer={<>
        {persona && (
          <div style={{ marginRight: 'auto' }}>
            <BotonEliminar small texto="Quitar del operativo" confirmar="Sí, quitar"
              onConfirm={async () => { await eliminarStaff(opId, persona.id, pasajeros, accesos); onClose(); }} />
          </div>
        )}
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Guardar'}</button>
      </>}>
      <div className="eg-form-grid">
        {rol === 'conductor' && !persona && padronConductores.length > 0 && (
          <Campo label="Elegir del padrón de conductores" full>
            <select defaultValue="" onChange={e => cargarDePadron(e.target.value)}>
              <option value="">— Nuevo conductor —</option>
              {padronOrdenado.map(c => <option key={c.id} value={c.id}>{c.apellido}, {c.nombre} · DNI {c.dni}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Nombre"><Input {...F} campo="nombre" autoFocus /></Campo>
        <Campo label="Apellido"><Input {...F} campo="apellido" /></Campo>
        <Campo label="DNI"><Input {...F} campo="dni" inputMode="numeric" /></Campo>
        <Campo label="Teléfono / WhatsApp" hint="Se usa para enviarle su link de acceso"><Input {...F} campo="telefono" type="tel" /></Campo>
        <Campo label="Email"><Input {...F} campo="email" type="email" /></Campo>
        <Campo label="Ómnibus asignado">
          <select value={form.busId} onChange={e => setForm(f => ({ ...f, busId: e.target.value }))}>
            <option value="">— Sin asignar —</option>
            {buses.map(b => <option key={b.id} value={b.id}>{b.codigo}</option>)}
          </select>
        </Campo>
        {rol === 'conductor' ? <>
          <Campo label="Licencia N°"><Input {...F} campo="licencia" /></Campo>
          <Campo label="Vencimiento licencia"><Input {...F} campo="vencLicencia" type="date" /></Campo>
        </> : (
          <Campo label="Grupo / colegio a cargo" full hint="Informativo. El responsable de cada pasajero se define en la pestaña Pasajeros (por defecto, el coordinador de su ómnibus).">
            <Input {...F} campo="grupo" />
          </Campo>
        )}
        <Campo label="Notas" full><TextArea {...F} campo="notas" rows={2} /></Campo>
      </div>
      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}
