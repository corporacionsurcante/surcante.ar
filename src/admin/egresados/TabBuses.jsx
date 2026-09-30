import React, { useState } from 'react';
import { crearEnSub, actualizarEnSub, eliminarBus, crearBuses } from '../../firebase/egresadosService';
import { Modal, Campo, Input, TextArea, BusChip, BarraOcupacion, BotonEliminar, Vacio } from './ui';
import { COLORES_BUS, nombreCompleto, fechaCorta } from './utils';

const VACIO = {
  codigo: '', color: 'violeta', orden: '', unidadId: '', empresa: 'SURCANTE', interno: '', patente: '', tipo: '',
  capacidad: 60, puntoSalida: '', presentacion: '', notas: '',
};

export default function TabBuses({ opId, op, buses, staff, pasajeros, unidades }) {
  const [editando, setEditando] = useState(null); // null | 'nuevo' | bus
  const [varios, setVarios] = useState(false);

  const usoUnidad = {};
  buses.forEach(b => { if (b.unidadId) usoUnidad[b.unidadId] = (usoUnidad[b.unidadId] || 0) + 1; });

  return (
    <>
      <div className="eg-head" style={{ marginBottom: 12 }}>
        <div className="eg-sub">Cada ómnibus tiene una identificación y un color que ven pasajeros, conductores y coordinadores.</div>
        <div className="eg-actions">
          <button className="eg-btn eg-btn-soft" onClick={() => setVarios(true)}>+ Agregar varios</button>
          <button className="eg-btn eg-btn-primary" onClick={() => setEditando('nuevo')}>+ Agregar ómnibus</button>
        </div>
      </div>

      {buses.length === 0 ? (
        <div className="eg-section"><Vacio icono="🚌">No hay ómnibus en este operativo.</Vacio></div>
      ) : (
        <div className="eg-grid">
          {buses.map(b => {
            const unidad = unidades.find(u => u.id === b.unidadId);
            const pax = pasajeros.filter(p => p.busId === b.id).length;
            const conds = staff.filter(s => s.rol === 'conductor' && s.busId === b.id);
            const coords = staff.filter(s => s.rol === 'coordinador' && s.busId === b.id);
            const ocupados = pax + coords.length;
            const cap = Number(b.capacidad || 0);
            return (
              <div key={b.id} className="eg-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <BusChip bus={b} />
                  <button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => setEditando(b)}>✏️ Editar</button>
                </div>
                <div className="eg-card-meta" style={{ marginTop: 10 }}>
                  🚍 {unidad
                    ? <>Interno <b>{unidad.interno}</b> · {unidad.patente} · {unidad.tipo}</>
                    : [b.empresa, b.interno && `Int. ${b.interno}`, b.patente, b.tipo].filter(Boolean).join(' · ') || <span style={{ color: '#CF1322' }}>Sin unidad asignada</span>}
                  {unidad?.venceTecnica && <><br />🔧 Técnica vence {fechaCorta(unidad.venceTecnica)}</>}
                  {usoUnidad[b.unidadId] > 1 && <><br /><span style={{ color: '#CF1322', fontWeight: 700 }}>⚠️ Esta unidad está asignada a otro ómnibus del operativo</span></>}
                  <br />🧑‍✈️ {conds.map(nombreCompleto).join(', ') || <span style={{ color: '#B07A00' }}>Sin conductor</span>}
                  <br />📋 {coords.map(nombreCompleto).join(', ') || <span style={{ color: '#B07A00' }}>Sin coordinador</span>}
                  {(b.puntoSalida || b.presentacion) && <><br />🚏 {[b.puntoSalida, b.presentacion && `presentación ${b.presentacion} h`].filter(Boolean).join(' · ')}</>}
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                    <span>{pax} pasajeros + {coords.length} coord.</span>
                    <span style={{ color: ocupados > cap ? '#CF1322' : '#4A4A6A' }}>{ocupados} / {cap}</span>
                  </div>
                  <BarraOcupacion usados={ocupados} total={cap} />
                </div>
                {b.notas && <div className="eg-sub" style={{ marginTop: 8 }}>📝 {b.notas}</div>}
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <BusForm
          opId={opId}
          bus={editando === 'nuevo' ? null : editando}
          siguiente={buses.length + 1}
          unidades={unidades}
          buses={buses}
          staff={staff}
          pasajeros={pasajeros}
          op={op}
          onClose={() => setEditando(null)}
        />
      )}
      {varios && <VariosForm opId={opId} buses={buses} onClose={() => setVarios(false)} />}
    </>
  );
}

function BusForm({ opId, bus, siguiente, unidades, buses, staff, pasajeros, onClose }) {
  const [form, setForm] = useState(() => bus
    ? { ...VACIO, ...bus, unidadId: bus.unidadId || '', orden: bus.orden ?? '' }
    : { ...VACIO, codigo: `Bus ${siguiente}`, orden: siguiente, color: COLORES_BUS[(siguiente - 1) % COLORES_BUS.length].id });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const unidadesActivas = unidades.filter(u => u.activa !== false);
  const externa = !form.unidadId;

  function elegirUnidad(id) {
    const u = unidades.find(x => x.id === id);
    setForm(f => u
      ? { ...f, unidadId: id, empresa: u.empresa || 'SURCANTE', interno: String(u.interno ?? ''), patente: u.patente || '', tipo: u.tipo || '', capacidad: u.butacas || f.capacidad }
      : { ...f, unidadId: '' });
  }

  async function guardar() {
    if (!String(form.codigo).trim()) { setError('Poné una identificación (ej: Bus 1).'); return; }
    const repetido = buses.find(b => b.id !== bus?.id && String(b.codigo).trim().toLowerCase() === String(form.codigo).trim().toLowerCase());
    if (repetido) { setError('Ya hay un ómnibus con esa identificación.'); return; }
    setGuardando(true);
    const data = {
      codigo: String(form.codigo).trim(),
      color: form.color,
      orden: form.orden === '' ? siguiente : Number(form.orden),
      unidadId: form.unidadId || null,
      empresa: String(form.empresa || '').trim(),
      interno: String(form.interno || '').trim(),
      patente: String(form.patente || '').trim().toUpperCase(),
      tipo: String(form.tipo || '').trim(),
      capacidad: Number(form.capacidad) || 0,
      puntoSalida: String(form.puntoSalida || '').trim(),
      presentacion: form.presentacion || '',
      notas: String(form.notas || '').trim(),
    };
    try {
      if (bus?.id) await actualizarEnSub(opId, 'buses', bus.id, data);
      else await crearEnSub(opId, 'buses', data);
      onClose();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar.');
      setGuardando(false);
    }
  }

  const F = { form, set: setForm };
  const asignados = bus ? pasajeros.filter(p => p.busId === bus.id).length + staff.filter(s => s.busId === bus.id).length : 0;

  return (
    <Modal
      titulo={bus ? `Editar ${bus.codigo}` : 'Nuevo ómnibus'}
      onClose={onClose}
      footer={<>
        {bus && (
          <div style={{ marginRight: 'auto' }}>
            <BotonEliminar
              small
              texto="Eliminar"
              confirmar={asignados ? `Eliminar y liberar ${asignados} personas` : 'Sí, eliminar'}
              onConfirm={async () => { await eliminarBus(opId, bus.id, pasajeros, staff); onClose(); }}
            />
          </div>
        )}
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Guardar'}</button>
      </>}>
      <div className="eg-form-grid">
        <Campo label="Identificación *"><Input {...F} campo="codigo" placeholder="Bus 1" /></Campo>
        <Campo label="Orden"><Input {...F} campo="orden" type="number" min="1" /></Campo>
        <Campo label="Color de identificación" full>
          <div className="eg-color-row">
            {COLORES_BUS.map(c => (
              <div key={c.id} title={c.label} className={`eg-color ${form.color === c.id ? 'sel' : ''}`} style={{ background: c.hex }}
                onClick={() => setForm(f => ({ ...f, color: c.id }))} />
            ))}
          </div>
        </Campo>

        <div className="eg-form-section full">Unidad</div>
        <Campo label="Unidad de la flota Surcante" full hint="Elegí un interno para completar patente y butacas. Dejalo en 'Externa' si es de otra empresa.">
          <select value={form.unidadId} onChange={e => elegirUnidad(e.target.value)}>
            <option value="">— Externa / otra empresa —</option>
            {unidadesActivas.map(u => (
              <option key={u.id} value={u.id}>Int. {u.interno} · {u.patente} · {u.tipo} · {u.butacas} butacas</option>
            ))}
          </select>
        </Campo>
        {externa && <>
          <Campo label="Empresa"><Input {...F} campo="empresa" /></Campo>
          <Campo label="Interno"><Input {...F} campo="interno" /></Campo>
          <Campo label="Patente"><Input {...F} campo="patente" placeholder="AA 123 BB" /></Campo>
          <Campo label="Tipo"><Input {...F} campo="tipo" placeholder="ej: Doble piso 60" /></Campo>
        </>}
        <Campo label="Capacidad (butacas)" full hint="Incluye a los coordinadores que viajan en el ómnibus.">
          <Input {...F} campo="capacidad" type="number" min="1" />
        </Campo>

        <div className="eg-form-section full">Particularidades de este ómnibus (opcional)</div>
        <Campo label="Punto de salida propio" hint="Si difiere del general del operativo"><Input {...F} campo="puntoSalida" /></Campo>
        <Campo label="Hora de presentación propia"><Input {...F} campo="presentacion" type="time" /></Campo>
        <Campo label="Notas" full><TextArea {...F} campo="notas" rows={2} /></Campo>
      </div>
      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

function VariosForm({ opId, buses, onClose }) {
  const [cantidad, setCantidad] = useState(2);
  const [capacidad, setCapacidad] = useState(60);
  const [prefijo, setPrefijo] = useState('Bus');
  const [guardando, setGuardando] = useState(false);
  const desde = buses.length + 1;

  async function crear() {
    const n = Math.max(1, Math.min(40, parseInt(cantidad, 10) || 1));
    setGuardando(true);
    await crearBuses(opId, Array.from({ length: n }, (_, i) => ({
      codigo: `${prefijo.trim() || 'Bus'} ${desde + i}`,
      orden: desde + i,
      capacidad: parseInt(capacidad, 10) || 60,
      color: COLORES_BUS[(desde + i - 1) % COLORES_BUS.length].id,
      unidadId: null, empresa: 'SURCANTE', interno: '', patente: '', tipo: '', puntoSalida: '', presentacion: '', notas: '',
    })));
    onClose();
  }

  return (
    <Modal titulo="Agregar varios ómnibus" onClose={onClose}
      footer={<>
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={crear} disabled={guardando}>{guardando ? 'Creando...' : `✓ Crear ${cantidad || 0}`}</button>
      </>}>
      <div className="eg-form-grid">
        <Campo label="Cantidad"><input type="number" min="1" max="40" value={cantidad} onChange={e => setCantidad(e.target.value)} /></Campo>
        <Campo label="Capacidad de cada uno"><input type="number" min="1" value={capacidad} onChange={e => setCapacidad(e.target.value)} /></Campo>
        <Campo label="Identificación" full hint={`Se crean desde "${prefijo || 'Bus'} ${desde}" en adelante.`}>
          <input value={prefijo} onChange={e => setPrefijo(e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}
