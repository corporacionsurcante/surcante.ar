import React, { useMemo } from 'react';
import { BusChip, BarraOcupacion } from './ui';
import { fechaCorta, labelFecha, nombreCompleto, rangoFechas } from './utils';

export default function TabResumen({ op, buses, staff, pasajeros, itinerario, accesos, unidades, irA, onEditar }) {
  const conductores = staff.filter(s => s.rol === 'conductor');
  const coordinadores = staff.filter(s => s.rol === 'coordinador');
  const busIds = new Set(buses.map(b => b.id));
  const sinBus = pasajeros.filter(p => !p.busId || !busIds.has(p.busId));
  const capacidadTotal = buses.reduce((s, b) => s + Number(b.capacidad || 0), 0);

  const porBus = useMemo(() => buses.map(b => {
    const pax = pasajeros.filter(p => p.busId === b.id).length;
    const coords = coordinadores.filter(s => s.busId === b.id);
    const conds = conductores.filter(s => s.busId === b.id);
    const unidad = unidades.find(u => u.id === b.unidadId);
    return { bus: b, pax, coords, conds, unidad, ocupados: pax + coords.length };
  }), [buses, pasajeros, coordinadores, conductores, unidades]);

  const alertas = useMemo(() => {
    const a = [];
    const fin = op.fechaFin || op.fechaInicio;
    if (!op.salida?.lugar || !op.salida?.hora) a.push({ t: 'warn', m: 'Falta completar lugar y hora de salida.', ir: 'editar' });
    if (buses.length === 0) a.push({ t: 'error', m: 'No hay ómnibus cargados.', ir: 'buses' });
    if (sinBus.length) a.push({ t: 'warn', m: `${sinBus.length} pasajero${sinBus.length === 1 ? '' : 's'} sin ómnibus asignado.`, ir: 'pasajeros' });
    const sinConductor = [];
    const sinCoordinador = [];
    const sinUnidad = [];
    porBus.forEach(({ bus, ocupados, conds, coords, unidad }) => {
      const cap = Number(bus.capacidad || 0);
      if (ocupados > cap) a.push({ t: 'error', m: `${bus.codigo}: ${ocupados} ocupantes para ${cap} butacas (sobrecupo de ${ocupados - cap}).`, ir: 'pasajeros' });
      if (conds.length === 0) sinConductor.push(bus.codigo);
      if (coords.length === 0) sinCoordinador.push(bus.codigo);
      if (!bus.patente && !unidad) sinUnidad.push(bus.codigo);
      if (unidad?.venceTecnica && fin && unidad.venceTecnica <= fin) {
        a.push({ t: 'error', m: `${bus.codigo} (interno ${unidad.interno}): la técnica vence el ${fechaCorta(unidad.venceTecnica)}, antes o durante el viaje.`, ir: 'buses' });
      }
    });
    if (sinConductor.length) a.push({ t: 'warn', m: `Sin conductor asignado: ${sinConductor.join(', ')}.`, ir: 'personal' });
    if (sinCoordinador.length) a.push({ t: 'warn', m: `Sin coordinador asignado: ${sinCoordinador.join(', ')}.`, ir: 'personal' });
    if (sinUnidad.length) a.push({ t: 'warn', m: `Sin unidad/patente asignada: ${sinUnidad.join(', ')}.`, ir: 'buses' });
    conductores.forEach(c => {
      if (c.vencLicencia && fin && c.vencLicencia <= fin) {
        const antes = c.vencLicencia < fin;
        a.push({ t: antes ? 'error' : 'warn', m: `La licencia de ${nombreCompleto(c)} vence el ${fechaCorta(c.vencLicencia)}${antes ? ', antes de terminar el viaje' : ', el último día del viaje'}.`, ir: 'personal' });
      }
    });
    const dnis = {};
    pasajeros.forEach(p => { if (p.dni) dnis[p.dni] = (dnis[p.dni] || 0) + 1; });
    const duplicados = Object.values(dnis).filter(n => n > 1).length;
    if (duplicados) a.push({ t: 'error', m: `Hay ${duplicados} DNI repetido${duplicados === 1 ? '' : 's'} en la lista de pasajeros.`, ir: 'pasajeros' });
    const sinDni = pasajeros.filter(p => !p.dni).length;
    if (sinDni) a.push({ t: 'warn', m: `${sinDni} pasajero${sinDni === 1 ? '' : 's'} sin DNI.`, ir: 'pasajeros' });
    const diasViaje = rangoFechas(op.fechaInicio, op.fechaFin);
    const diasCargados = new Set(itinerario.filter(d => (d.actividades || []).length).map(d => d.fecha || d.id));
    const faltan = diasViaje.filter(d => !diasCargados.has(d));
    if (diasViaje.length && faltan.length) a.push({ t: 'info', m: `Diagrama sin actividades en ${faltan.length} de ${diasViaje.length} días (${faltan.slice(0, 4).map(d => labelFecha(d)).join(', ')}${faltan.length > 4 ? '…' : ''}).`, ir: 'itinerario' });
    const conAcceso = new Set(accesos.map(x => x.refId));
    const personas = pasajeros.length + staff.length;
    const sinLink = pasajeros.filter(p => !conAcceso.has(p.id)).length + staff.filter(s => !conAcceso.has(s.id)).length;
    if (personas && sinLink) a.push({ t: 'info', m: `${sinLink} persona${sinLink === 1 ? '' : 's'} todavía sin link de acceso.`, ir: 'accesos' });
    return a;
  }, [op, buses, sinBus, porBus, conductores, pasajeros, itinerario, accesos, staff]);

  const irAlerta = destino => (destino === 'editar' ? onEditar() : irA(destino));

  return (
    <>
      <div className="eg-metrics">
        <Metrica label="Pasajeros" val={pasajeros.length} sub={op.pasajerosEstimados ? `de ${op.pasajerosEstimados} estimados` : `${sinBus.length} sin ómnibus`} />
        <Metrica label="Ómnibus" val={buses.length} sub={`${capacidadTotal} butacas en total`} />
        <Metrica label="Ocupación" val={capacidadTotal ? `${Math.round(((pasajeros.length + coordinadores.length) / capacidadTotal) * 100)}%` : '—'} sub={`${Math.max(0, capacidadTotal - pasajeros.length - coordinadores.length)} butacas libres`} />
        <Metrica label="Conductores" val={conductores.length} sub={`${coordinadores.length} coordinadores`} />
        <Metrica label="Links generados" val={accesos.length} sub={`de ${pasajeros.length + staff.length} personas`} />
      </div>

      <div className="eg-section">
        <div className="eg-section-title">Controles del operativo</div>
        {alertas.length === 0
          ? <div className="eg-alert eg-alert-ok">✅ Todo en orden: buses con conductor y coordinador, pasajeros asignados y diagrama completo.</div>
          : alertas.map((al, i) => (
            <div key={i} className={`eg-alert eg-alert-${al.t}`}>
              <span>{al.t === 'error' ? '⛔' : al.t === 'warn' ? '⚠️' : 'ℹ️'}</span>
              <span style={{ flex: 1 }}>{al.m}</span>
              {al.ir && <button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => irAlerta(al.ir)}>Resolver →</button>}
            </div>
          ))}
      </div>

      <div className="eg-section">
        <div className="eg-section-title">
          <span>Ómnibus y ocupación</span>
          <button className="eg-btn eg-btn-soft eg-btn-sm" onClick={() => irA('buses')}>Gestionar ómnibus</button>
        </div>
        {porBus.length === 0 ? <div className="eg-sub">Sin ómnibus cargados.</div> : (
          <div className="eg-table-wrap" style={{ border: 'none' }}>
            <table className="eg-table">
              <thead>
                <tr><th>Ómnibus</th><th>Unidad</th><th>Conductores</th><th>Coordinadores</th><th>Pasajeros</th><th style={{ minWidth: 140 }}>Ocupación</th></tr>
              </thead>
              <tbody>
                {porBus.map(({ bus, pax, coords, conds, unidad, ocupados }) => (
                  <tr key={bus.id}>
                    <td><BusChip bus={bus} /></td>
                    <td className="muted">{unidad ? `Int. ${unidad.interno} · ${unidad.patente}` : [bus.interno && `Int. ${bus.interno}`, bus.patente].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{conds.map(nombreCompleto).join(', ') || <span className="muted">—</span>}</td>
                    <td>{coords.map(nombreCompleto).join(', ') || <span className="muted">—</span>}</td>
                    <td><b>{pax}</b></td>
                    <td>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{ocupados} / {bus.capacidad || 0}</div>
                      <BarraOcupacion usados={ocupados} total={Number(bus.capacidad || 0)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="eg-form-grid">
        <div className="eg-section" style={{ marginBottom: 0 }}>
          <div className="eg-section-title">🚏 Salida</div>
          <Dato k="Lugar" v={op.salida?.lugar} />
          <Dato k="Dirección" v={op.salida?.direccion} />
          <Dato k="Fecha" v={op.salida?.fecha ? labelFecha(op.salida.fecha, { largo: true }) : ''} />
          <Dato k="Presentación" v={op.salida?.presentacion && `${op.salida.presentacion} h`} />
          <Dato k="Salida" v={op.salida?.hora && `${op.salida.hora} h`} />
          {op.salida?.indicaciones && <div className="eg-sub" style={{ marginTop: 8 }}>📝 {op.salida.indicaciones}</div>}
        </div>
        <div className="eg-section" style={{ marginBottom: 0 }}>
          <div className="eg-section-title">🏁 Regreso y contactos</div>
          <Dato k="Fecha" v={op.regreso?.fecha ? labelFecha(op.regreso.fecha, { largo: true }) : ''} />
          <Dato k="Llegada estimada" v={op.regreso?.hora && `${op.regreso.hora} h`} />
          <Dato k="Lugar" v={op.regreso?.lugar} />
          <Dato k="Agencia en destino" v={[op.contactoDestinoNombre, op.contactoDestinoTel].filter(Boolean).join(' · ')} />
          <Dato k="Emergencias Surcante" v={op.telEmergencia} />
        </div>
      </div>
    </>
  );
}

function Metrica({ label, val, sub }) {
  return (
    <div className="eg-metric">
      <div className="eg-metric-label">{label}</div>
      <div className="eg-metric-val">{val}</div>
      {sub && <div className="eg-metric-sub">{sub}</div>}
    </div>
  );
}

function Dato({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid rgba(139,92,246,0.12)', fontSize: 13 }}>
      <span style={{ color: 'rgba(240,238,255,0.45)', fontWeight: 600 }}>{k}</span>
      <span style={{ fontWeight: 700, textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );
}
