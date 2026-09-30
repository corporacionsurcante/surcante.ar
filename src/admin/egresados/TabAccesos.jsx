import React, { useMemo, useState } from 'react';
import {
  generarAccesos, regenerarAcceso, eliminarAcceso, marcarAccesoEnviado,
} from '../../firebase/egresadosService';
import { BusChip, BotonEliminar, Vacio, useToast, copiarTexto } from './ui';
import {
  apellidoNombre, nombreCompleto, normalizarTexto, linkAcceso, linkWhatsApp, mensajeAcceso,
  descargarCSV, ROLES, telefonoWhatsApp,
} from './utils';

const ORDEN_ROL = { conductor: 0, coordinador: 1, pasajero: 2 };

export default function TabAccesos({ opId, op, buses, staff, pasajeros, accesos }) {
  const [filtroRol, setFiltroRol] = useState('todos');
  const [filtroBus, setFiltroBus] = useState('todos');
  const [soloSinLink, setSoloSinLink] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [toast, mostrar] = useToast();

  const accesoPorRef = useMemo(() => {
    const m = {};
    accesos.forEach(a => { m[a.refId] = a; });
    return m;
  }, [accesos]);

  const personas = useMemo(() => {
    const lista = [
      ...staff.map(s => ({ ...s, rol: s.rol, refId: s.id })),
      ...pasajeros.map(p => ({ ...p, rol: 'pasajero', refId: p.id })),
    ];
    const idxBus = id => { const i = buses.findIndex(b => b.id === id); return i < 0 ? 999 : i; };
    return lista.sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || idxBus(a.busId) - idxBus(b.busId) || apellidoNombre(a).localeCompare(apellidoNombre(b), 'es'));
  }, [staff, pasajeros, buses]);

  const filtradas = personas.filter(p => {
    if (filtroRol !== 'todos' && p.rol !== filtroRol) return false;
    if (filtroBus !== 'todos' && (p.busId || '') !== (filtroBus === 'sin' ? '' : filtroBus)) return false;
    if (soloSinLink && accesoPorRef[p.refId]) return false;
    const q = normalizarTexto(busqueda);
    if (q && !normalizarTexto([p.apellido, p.nombre, p.dni, p.telefono].join(' ')).includes(q)) return false;
    return true;
  });

  const sinLink = filtradas.filter(p => !accesoPorRef[p.refId]);

  const datosLink = p => {
    const acc = accesoPorRef[p.refId];
    if (!acc) return null;
    const link = linkAcceso(acc.id);
    const bus = buses.find(b => b.id === p.busId);
    const texto = mensajeAcceso({ rol: p.rol, nombre: p.nombre, operativo: op, bus, link });
    return { acc, link, texto };
  };

  async function generarFaltantes() {
    if (!sinLink.length) return;
    setTrabajando(true);
    try {
      await generarAccesos(opId, sinLink.map(p => ({ rol: p.rol, refId: p.refId, nombre: nombreCompleto(p) })));
      mostrar(`✓ ${sinLink.length} links generados`);
    } catch (e) {
      console.error(e);
      mostrar('No se pudieron generar los links');
    }
    setTrabajando(false);
  }

  async function generarUno(p) {
    await generarAccesos(opId, [{ rol: p.rol, refId: p.refId, nombre: nombreCompleto(p) }]);
  }

  async function copiar(p) {
    const d = datosLink(p);
    if (!d) return;
    const ok = await copiarTexto(d.texto);
    mostrar(ok ? '📋 Mensaje con link copiado' : 'No se pudo copiar');
  }

  function enviarWhatsApp(p) {
    const d = datosLink(p);
    if (!d) return;
    window.open(linkWhatsApp(p.telefono, d.texto), '_blank', 'noopener');
    marcarAccesoEnviado(d.acc.id).catch(() => {});
  }

  function exportar() {
    const filas = filtradas.map(p => {
      const d = datosLink(p);
      const bus = buses.find(b => b.id === p.busId);
      return [
        ROLES[p.rol].label, apellidoNombre(p), p.dni || '', bus?.codigo || '', p.telefono || '',
        d?.link || '(sin generar)', d?.texto || '', d && p.telefono ? linkWhatsApp(p.telefono, d.texto) : '',
      ];
    });
    descargarCSV(`Links ${op.nombre}.csv`, ['Rol', 'Apellido y nombre', 'DNI', 'Ómnibus', 'Teléfono', 'Link personal', 'Mensaje', 'Link WhatsApp'], filas);
  }

  const enviados = accesos.filter(a => a.enviadoEn).length;

  return (
    <>
      <div className="eg-alert eg-alert-info">
        🔗 Cada persona tiene un link único y privado. Al abrirlo entra directo a su vista (pasajero, conductor o coordinador) sin usuario ni contraseña.
        Si un link se filtra, regeneralo: el anterior deja de funcionar.
      </div>

      <div className="eg-metrics" style={{ marginTop: 12 }}>
        <div className="eg-metric"><div className="eg-metric-label">Personas</div><div className="eg-metric-val">{personas.length}</div></div>
        <div className="eg-metric"><div className="eg-metric-label">Con link</div><div className="eg-metric-val">{accesos.length}</div></div>
        <div className="eg-metric"><div className="eg-metric-label">Enviados por WhatsApp</div><div className="eg-metric-val">{enviados}</div></div>
        <div className="eg-metric"><div className="eg-metric-label">Ya ingresaron</div><div className="eg-metric-val">{accesos.filter(a => a.ultimoAcceso).length}</div></div>
      </div>

      <div className="eg-toolbar">
        <input className="eg-input" placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="eg-input" value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
          <option value="todos">Todos los roles</option>
          {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.plural}</option>)}
        </select>
        <select className="eg-input" value={filtroBus} onChange={e => setFiltroBus(e.target.value)}>
          <option value="todos">Todos los ómnibus</option>
          {buses.map(b => <option key={b.id} value={b.id}>{b.codigo}</option>)}
          <option value="sin">Sin ómnibus</option>
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>
          <input type="checkbox" checked={soloSinLink} onChange={e => setSoloSinLink(e.target.checked)} /> Solo sin link
        </label>
      </div>
      <div className="eg-actions" style={{ marginBottom: 12 }}>
        <button className="eg-btn eg-btn-primary" onClick={generarFaltantes} disabled={trabajando || !sinLink.length}>
          {trabajando ? 'Generando...' : sinLink.length ? `⚡ Generar ${sinLink.length} link${sinLink.length === 1 ? '' : 's'} faltante${sinLink.length === 1 ? '' : 's'}` : '✓ Todos tienen link'}
        </button>
        <button className="eg-btn eg-btn-ghost" onClick={exportar} disabled={!filtradas.length}>⬇️ Exportar links (Excel/CSV)</button>
      </div>

      {personas.length === 0 ? (
        <div className="eg-section"><Vacio icono="🔗">Cargá conductores, coordinadores y pasajeros para generar sus links.</Vacio></div>
      ) : (
        <div className="eg-table-wrap" style={{ maxHeight: '65vh' }}>
          <table className="eg-table">
            <thead><tr><th>Rol</th><th>Persona</th><th>Ómnibus</th><th>Teléfono</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtradas.map(p => {
                const d = datosLink(p);
                const bus = buses.find(b => b.id === p.busId);
                const tel = telefonoWhatsApp(p.telefono);
                return (
                  <tr key={`${p.rol}-${p.refId}`}>
                    <td><span className="eg-chip">{ROLES[p.rol].icon} {ROLES[p.rol].label}</span></td>
                    <td style={{ fontWeight: 700 }}>{apellidoNombre(p)}</td>
                    <td><BusChip bus={bus} /></td>
                    <td className="muted">{p.telefono || '—'}</td>
                    <td>
                      {!d ? <span className="eg-chip eg-chip-amber">Sin link</span>
                        : d.acc.ultimoAcceso ? <span className="eg-chip eg-chip-green">✓ Ingresó</span>
                          : d.acc.enviadoEn ? <span className="eg-chip eg-chip-purple">Enviado</span>
                            : <span className="eg-chip">Generado</span>}
                    </td>
                    <td>
                      {!d ? (
                        <button className="eg-btn eg-btn-soft eg-btn-sm" onClick={() => generarUno(p)}>Generar</button>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="eg-btn eg-btn-green eg-btn-sm" onClick={() => enviarWhatsApp(p)} title={tel ? `Enviar a ${tel}` : 'Elegir contacto en WhatsApp'}>
                            WhatsApp{tel ? '' : ' …'}
                          </button>
                          <button className="eg-btn eg-btn-ghost eg-btn-sm" onClick={() => copiar(p)}>📋 Copiar</button>
                          <button className="eg-btn eg-btn-ghost eg-btn-sm" title="Invalida el link anterior"
                            onClick={async () => { await regenerarAcceso(opId, d.acc); mostrar('🔄 Link regenerado: el anterior ya no funciona'); }}>🔄</button>
                          <BotonEliminar small texto="" confirmar="¿Revocar?" onConfirm={() => eliminarAcceso(d.acc.id)} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {toast}
    </>
  );
}
