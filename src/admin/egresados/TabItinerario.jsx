import React, { useMemo, useState } from 'react';
import { guardarEnSub, eliminarEnSub } from '../../firebase/egresadosService';
import { Modal, Campo, Input, TextArea, BusChip, BotonEliminar, Vacio, useToast } from './ui';
import { rangoFechas, labelFecha, generarToken } from './utils';

const ACT_VACIA = {
  hora: '', horaFin: '', titulo: '', lugar: '', direccion: '', buses: [], soloStaff: false,
  paraPasajeros: '', paraConductores: '', paraCoordinadores: '',
};

const DIA_VACIO = { titulo: '', resumen: '', sugerencias: '', notasConductores: '', notasCoordinadores: '' };

const porHora = (a, b) => String(a.hora || '99:99').localeCompare(String(b.hora || '99:99'));

export default function TabItinerario({ opId, op, buses, itinerario }) {
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [editAct, setEditAct] = useState(null); // { fecha, act? }
  const [editDia, setEditDia] = useState(null); // fecha
  const [copiar, setCopiar] = useState(null); // fecha origen
  const [toast, mostrar] = useToast();

  const porFecha = useMemo(() => {
    const m = {};
    itinerario.forEach(d => { m[d.fecha || d.id] = d; });
    return m;
  }, [itinerario]);

  const fechasViaje = rangoFechas(op.fechaInicio, op.fechaFin);
  const fechas = [...new Set([...fechasViaje, ...Object.keys(porFecha)])].sort();

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

  async function borrarActividad(fecha, id) {
    const dia = porFecha[fecha] || {};
    await guardarEnSub(opId, 'itinerario', fecha, { fecha, actividades: (dia.actividades || []).filter(a => a.id !== id) });
  }

  if (!op.fechaInicio) {
    return <div className="eg-section"><Vacio icono="🗓️">Cargá las fechas del viaje en "Datos del viaje" para armar el diagrama día a día.</Vacio></div>;
  }

  return (
    <>
      <div className="eg-head" style={{ marginBottom: 12 }}>
        <div className="eg-sub">
          Cada actividad puede tener indicaciones distintas para <span className="eg-chip" style={{ background: 'rgba(196,181,253,0.15)', color: '#C4B5FD' }}>pasajeros</span>{' '}
          <span className="eg-chip" style={{ background: 'rgba(45,212,191,0.15)', color: '#2DD4BF' }}>conductores</span>{' '}
          <span className="eg-chip" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>coordinadores</span> y aplicar a todos los ómnibus o solo a algunos.
        </div>
        <div className="eg-actions">
          <button className="eg-btn eg-btn-ghost" onClick={() => setAbiertos(abiertos.size ? new Set() : new Set(fechas))}>
            {abiertos.size ? 'Contraer todo' : 'Expandir todo'}
          </button>
        </div>
      </div>

      {fechas.map(fecha => {
        const dia = porFecha[fecha] || {};
        const acts = [...(dia.actividades || [])].sort(porHora);
        const abierto = abiertos.has(fecha);
        const nroDia = fechasViaje.indexOf(fecha) + 1;
        const esSalida = fecha === (op.salida?.fecha || op.fechaInicio);
        const esRegreso = fecha === (op.regreso?.fecha || op.fechaFin);
        return (
          <div key={fecha} className="eg-day">
            <div className="eg-day-head" onClick={() => toggle(fecha)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                <div className="eg-day-num"><b>{nroDia || '·'}</b><span>DÍA</span></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{labelFecha(fecha, { largo: true })}{dia.titulo ? ` · ${dia.titulo}` : ''}</div>
                  <div className="eg-sub" style={{ marginTop: 2 }}>
                    {acts.length ? `${acts.length} actividad${acts.length === 1 ? '' : 'es'} · ${acts.slice(0, 3).map(a => a.titulo).join(', ')}${acts.length > 3 ? '…' : ''}` : 'Sin actividades'}
                    {nroDia === 0 && ' · fuera de las fechas del viaje'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {esSalida && <span className="eg-chip eg-chip-purple">🚏 Salida</span>}
                {esRegreso && <span className="eg-chip eg-chip-purple">🏁 Regreso</span>}
                <span style={{ fontSize: 14, color: 'rgba(240,238,255,0.45)' }}>{abierto ? '▲' : '▼'}</span>
              </div>
            </div>

            {abierto && (
              <div className="eg-day-body">
                {esSalida && op.salida?.lugar && (
                  <div className="eg-alert eg-alert-info" style={{ marginTop: 10 }}>
                    🚏 Salida general: {op.salida.presentacion ? `presentación ${op.salida.presentacion} h · ` : ''}{op.salida.hora ? `salida ${op.salida.hora} h · ` : ''}{op.salida.lugar}
                  </div>
                )}
                {(dia.resumen || dia.sugerencias || dia.notasConductores || dia.notasCoordinadores) && (
                  <div className="eg-act-notes" style={{ margin: '10px 0' }}>
                    {dia.resumen && <div className="eg-act-note eg-note-pax"><b>Resumen del día:</b>{dia.resumen}</div>}
                    {dia.sugerencias && <div className="eg-act-note eg-note-pax"><b>💡 Sugerencias:</b>{dia.sugerencias}</div>}
                    {dia.notasConductores && <div className="eg-act-note eg-note-cond"><b>Conductores:</b>{dia.notasConductores}</div>}
                    {dia.notasCoordinadores && <div className="eg-act-note eg-note-coord"><b>Coordinadores:</b>{dia.notasCoordinadores}</div>}
                  </div>
                )}

                {acts.length === 0 && <div className="eg-sub" style={{ padding: '12px 0' }}>Todavía no hay actividades este día.</div>}
                {acts.map(a => (
                  <div key={a.id} className="eg-act">
                    <div className="eg-act-hora">{a.hora || '--:--'}{a.horaFin && <small>hasta {a.horaFin}</small>}</div>
                    <div>
                      <div className="eg-act-title">{a.titulo || 'Actividad'} {a.soloStaff && <span className="eg-chip eg-chip-amber">Solo staff</span>}</div>
                      {(a.lugar || a.direccion) && (
                        <div className="eg-act-lugar">
                          📍 {[a.lugar, a.direccion].filter(Boolean).join(' · ')}
                          {a.direccion && <> · <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.direccion)}`} target="_blank" rel="noreferrer">mapa</a></>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {(a.buses || []).length === 0
                          ? <span className="eg-chip">Todos los ómnibus</span>
                          : a.buses.map(id => <BusChip key={id} bus={buses.find(b => b.id === id)} vacio="Bus eliminado" />)}
                      </div>
                      {(a.paraPasajeros || a.paraConductores || a.paraCoordinadores) && (
                        <div className="eg-act-notes">
                          {a.paraPasajeros && !a.soloStaff && <div className="eg-act-note eg-note-pax"><b>Pasajeros:</b>{a.paraPasajeros}</div>}
                          {a.paraConductores && <div className="eg-act-note eg-note-cond"><b>Conductores:</b>{a.paraConductores}</div>}
                          {a.paraCoordinadores && <div className="eg-act-note eg-note-coord"><b>Coordinadores:</b>{a.paraCoordinadores}</div>}
                        </div>
                      )}
                    </div>
                    <div className="eg-act-btns" style={{ display: 'flex', gap: 4 }}>
                      <button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => setEditAct({ fecha, act: a })}>✏️</button>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  <button className="eg-btn eg-btn-primary eg-btn-sm" onClick={() => setEditAct({ fecha })}>+ Actividad</button>
                  <button className="eg-btn eg-btn-soft eg-btn-sm" onClick={() => setEditDia(fecha)}>📝 Resumen, sugerencias y notas del día</button>
                  {acts.length > 0 && <button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => setCopiar(fecha)}>📄 Copiar a otro día</button>}
                  {porFecha[fecha] && (
                    <div style={{ marginLeft: 'auto' }}>
                      <BotonEliminar small texto="Vaciar día" confirmar="Sí, vaciar" onConfirm={() => eliminarEnSub(opId, 'itinerario', fecha)} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {editAct && (
        <ActividadForm
          fecha={editAct.fecha}
          act={editAct.act}
          buses={buses}
          onClose={() => setEditAct(null)}
          onGuardar={async act => { await guardarActividad(editAct.fecha, act); setEditAct(null); }}
          onBorrar={async () => { await borrarActividad(editAct.fecha, editAct.act.id); setEditAct(null); }}
        />
      )}
      {editDia && (
        <DiaForm
          fecha={editDia}
          dia={porFecha[editDia]}
          onClose={() => setEditDia(null)}
          onGuardar={async data => { await guardarEnSub(opId, 'itinerario', editDia, { fecha: editDia, ...data }); setEditDia(null); }}
        />
      )}
      {copiar && (
        <CopiarDia
          origen={copiar}
          fechas={fechas.filter(f => f !== copiar)}
          porFecha={porFecha}
          onClose={() => setCopiar(null)}
          onCopiar={async (destino, modo) => {
            const o = porFecha[copiar] || {};
            const d = porFecha[destino] || {};
            const copiadas = (o.actividades || []).map(a => ({ ...a, id: generarToken(8) }));
            const actividades = (modo === 'agregar' ? [...(d.actividades || []), ...copiadas] : copiadas).sort(porHora);
            const cabecera = {};
            Object.keys(DIA_VACIO).forEach(k => { cabecera[k] = modo === 'agregar' && d[k] ? d[k] : (o[k] || ''); });
            await guardarEnSub(opId, 'itinerario', destino, { fecha: destino, ...cabecera, actividades });
            setCopiar(null);
            setAbiertos(prev => new Set(prev).add(destino));
            mostrar(`✓ Copiado a ${labelFecha(destino)}`);
          }}
        />
      )}
      {toast}
    </>
  );
}

function ActividadForm({ fecha, act, buses, onClose, onGuardar, onBorrar }) {
  const [form, setForm] = useState(() => ({ ...ACT_VACIA, ...(act || {}), buses: act?.buses || [] }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function toggleBus(id) {
    setForm(f => ({ ...f, buses: f.buses.includes(id) ? f.buses.filter(x => x !== id) : [...f.buses, id] }));
  }

  async function guardar() {
    if (!form.titulo.trim()) { setError('Poné un título a la actividad.'); return; }
    setGuardando(true);
    const t = v => String(v ?? '').trim();
    await onGuardar({
      id: act?.id || generarToken(8),
      hora: form.hora, horaFin: form.horaFin,
      titulo: t(form.titulo), lugar: t(form.lugar), direccion: t(form.direccion),
      buses: form.buses.filter(id => buses.some(b => b.id === id)),
      soloStaff: !!form.soloStaff,
      paraPasajeros: t(form.paraPasajeros), paraConductores: t(form.paraConductores), paraCoordinadores: t(form.paraCoordinadores),
    });
  }

  const F = { form, set: setForm };
  return (
    <Modal
      titulo={`${act ? 'Editar actividad' : 'Nueva actividad'} · ${labelFecha(fecha)}`}
      onClose={onClose}
      footer={<>
        {act && <div style={{ marginRight: 'auto' }}><BotonEliminar small texto="Borrar" confirmar="Sí, borrar" onConfirm={onBorrar} /></div>}
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Guardar'}</button>
      </>}>
      <div className="eg-form-grid">
        <Campo label="Hora"><Input {...F} campo="hora" type="time" autoFocus /></Campo>
        <Campo label="Hasta (opcional)"><Input {...F} campo="horaFin" type="time" /></Campo>
        <Campo label="Actividad *" full><Input {...F} campo="titulo" placeholder="ej: Excursión Cerro Catedral" /></Campo>
        <Campo label="Lugar"><Input {...F} campo="lugar" placeholder="ej: Base Cerro Catedral" /></Campo>
        <Campo label="Dirección (para el mapa)"><Input {...F} campo="direccion" placeholder="Av. de los Pioneros 1234, Bariloche" /></Campo>
        <Campo label="Aplica a" full hint="Sin marcar ninguno = todos los ómnibus">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {buses.map(b => (
              <span key={b.id} onClick={() => toggleBus(b.id)} style={{ cursor: 'pointer', opacity: form.buses.length === 0 || form.buses.includes(b.id) ? 1 : 0.35 }}>
                <BusChip bus={b} />
              </span>
            ))}
            {buses.length === 0 && <span className="eg-sub">No hay ómnibus cargados.</span>}
          </div>
        </Campo>
        <Campo label="🎒 Info para pasajeros" full>
          <TextArea {...F} campo="paraPasajeros" rows={2} placeholder="ej: Llevar ropa de nieve, guantes y protector solar. Almuerzo incluido." />
        </Campo>
        <Campo label="🧑‍✈️ Indicaciones para conductores" full>
          <TextArea {...F} campo="paraConductores" rows={2} placeholder="ej: Estacionar en playón B. Esperar hasta las 17 h." />
        </Campo>
        <Campo label="📋 Indicaciones para coordinadores" full>
          <TextArea {...F} campo="paraCoordinadores" rows={2} placeholder="ej: Retirar vouchers en boletería. Control de presentes antes de subir." />
        </Campo>
        <label className="full" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={!!form.soloStaff} onChange={e => setForm(f => ({ ...f, soloStaff: e.target.checked }))} />
          No mostrar a los pasajeros (solo conductores y coordinadores)
        </label>
      </div>
      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

function DiaForm({ fecha, dia, onClose, onGuardar }) {
  const [form, setForm] = useState(() => ({ ...DIA_VACIO, ...(dia || {}) }));
  const [guardando, setGuardando] = useState(false);
  const F = { form, set: setForm };
  async function guardar() {
    setGuardando(true);
    const data = {};
    Object.keys(DIA_VACIO).forEach(k => { data[k] = String(form[k] ?? '').trim(); });
    await onGuardar(data);
  }
  return (
    <Modal titulo={labelFecha(fecha, { largo: true })} onClose={onClose}
      footer={<>
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Guardar'}</button>
      </>}>
      <div className="eg-form-grid">
        <Campo label="Título del día" full><Input {...F} campo="titulo" placeholder="ej: Día de nieve" autoFocus /></Campo>
        <Campo label="🎒 Resumen para pasajeros" full><TextArea {...F} campo="resumen" rows={3} placeholder="Qué van a hacer hoy, en pocas palabras." /></Campo>
        <Campo label="💡 Sugerencias para pasajeros" full><TextArea {...F} campo="sugerencias" rows={2} placeholder="ej: Abrigarse bien, llevar agua y cargar el celular." /></Campo>
        <Campo label="🧑‍✈️ Notas generales para conductores" full><TextArea {...F} campo="notasConductores" rows={2} /></Campo>
        <Campo label="📋 Notas generales para coordinadores" full><TextArea {...F} campo="notasCoordinadores" rows={2} /></Campo>
      </div>
    </Modal>
  );
}

function CopiarDia({ origen, fechas, porFecha, onClose, onCopiar }) {
  const [destino, setDestino] = useState(fechas[0] || '');
  const [modo, setModo] = useState('reemplazar');
  const [trabajando, setTrabajando] = useState(false);
  const existentes = (porFecha[destino]?.actividades || []).length;
  return (
    <Modal titulo={`Copiar ${labelFecha(origen)}`} onClose={onClose}
      footer={<>
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" disabled={!destino || trabajando}
          onClick={async () => { setTrabajando(true); await onCopiar(destino, modo); }}>
          {trabajando ? 'Copiando...' : '✓ Copiar'}
        </button>
      </>}>
      <div className="eg-form-grid">
        <Campo label="Copiar a" full>
          <select value={destino} onChange={e => setDestino(e.target.value)}>
            {fechas.map(f => <option key={f} value={f}>{labelFecha(f, { largo: true })} {(porFecha[f]?.actividades || []).length ? `(${porFecha[f].actividades.length} act.)` : ''}</option>)}
          </select>
        </Campo>
        {existentes > 0 && (
          <Campo label={`Ese día ya tiene ${existentes} actividades`} full>
            <select value={modo} onChange={e => setModo(e.target.value)}>
              <option value="reemplazar">Reemplazarlas</option>
              <option value="agregar">Agregar a las existentes</option>
            </select>
          </Campo>
        )}
      </div>
    </Modal>
  );
}
