import React, { useState, useRef } from 'react';
import { Modal, Campo, Input, TextArea } from './ui';
import { crearOperativo, actualizarOperativo, importarMaestro } from '../../firebase/egresadosService';
import { COLORES_BUS, ESTADOS_OPERATIVO } from './utils';
import { parsearExcelMaestro } from './ImportarMaestro';

function aForm(op) {
  const s = op?.salida || {};
  const r = op?.regreso || {};
  return {
    nombre: op?.nombre || '',
    destino: op?.destino || '',
    estado: op?.estado || 'planificacion',
    fechaInicio: op?.fechaInicio || '',
    fechaFin: op?.fechaFin || '',
    colegios: op?.colegios || '',
    pasajerosEstimados: op?.pasajerosEstimados ?? '',
    salidaLugar: s.lugar || '',
    salidaDireccion: s.direccion || '',
    salidaFecha: s.fecha || '',
    salidaHora: s.hora || '',
    salidaPresentacion: s.presentacion || '',
    salidaIndicaciones: s.indicaciones || '',
    regresoFecha: r.fecha || '',
    regresoHora: r.hora || '',
    regresoLugar: r.lugar || '',
    contactoDestinoNombre: op?.contactoDestinoNombre || '',
    contactoDestinoTel: op?.contactoDestinoTel || '',
    telEmergencia: op?.telEmergencia || '',
    infoPasajeros: op?.infoPasajeros || '',
    notasInternas: op?.notasInternas || '',
    // solo al crear
    cantidadBuses: 1,
    capacidadDefault: 60,
    prefijoBus: 'Bus',
  };
}

export default function OperativoForm({ agencia, operativo, onClose, onCreado }) {
  const esNuevo = !operativo?.id;
  const [form, setForm] = useState(() => aForm(operativo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [modo, setModo] = useState('manual');
  const [excelDatos, setExcelDatos] = useState(null);
  const [cargandoExcel, setCargandoExcel] = useState(false);
  const [excelError, setExcelError] = useState('');
  const inputExcelRef = useRef(null);

  async function abrirExcel(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setExcelError('El archivo supera 10 MB.'); return; }
    setCargandoExcel(true); setExcelError('');
    try {
      const d = await parsearExcelMaestro(file);
      setExcelDatos(d);
      if (d.itinerario?.length > 0) {
        const fechas = d.itinerario.map(i => i.fecha).filter(Boolean).sort();
        if (fechas.length > 0) setForm(f => ({ ...f, fechaInicio: f.fechaInicio || fechas[0] }));
        if (fechas.length > 1) setForm(f => ({ ...f, fechaFin: f.fechaFin || fechas[fechas.length - 1] }));
      }
    } catch (e) { setExcelError(e.message || 'No se pudo leer el archivo.'); }
    setCargandoExcel(false);
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('Poné un nombre al operativo (ej: Bariloche 2026 · Colegio San José).'); return; }
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) { setError('La fecha de fin es anterior a la de inicio.'); return; }
    if (esNuevo && modo === 'excel' && !excelDatos) { setError('Subí el archivo Excel Maestro antes de continuar.'); return; }
    setGuardando(true);
    setError('');
    const t = v => String(v ?? '').trim();
    const data = {
      nombre: t(form.nombre),
      destino: t(form.destino),
      estado: form.estado,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin || form.fechaInicio,
      colegios: t(form.colegios),
      pasajerosEstimados: form.pasajerosEstimados === '' ? null : Number(form.pasajerosEstimados),
      salida: {
        lugar: t(form.salidaLugar),
        direccion: t(form.salidaDireccion),
        fecha: form.salidaFecha || form.fechaInicio,
        hora: form.salidaHora,
        presentacion: form.salidaPresentacion,
        indicaciones: t(form.salidaIndicaciones),
      },
      regreso: {
        fecha: form.regresoFecha || form.fechaFin || form.fechaInicio,
        hora: form.regresoHora,
        lugar: t(form.regresoLugar),
      },
      contactoDestinoNombre: t(form.contactoDestinoNombre),
      contactoDestinoTel: t(form.contactoDestinoTel),
      telEmergencia: t(form.telEmergencia),
      infoPasajeros: t(form.infoPasajeros),
      notasInternas: t(form.notasInternas),
    };
    try {
      if (esNuevo) {
        let buses;
        if (modo === 'excel') {
          buses = [];
        } else {
          const n = Math.max(0, Math.min(40, parseInt(form.cantidadBuses, 10) || 0));
          const cap = parseInt(form.capacidadDefault, 10) || 60;
          const pref = t(form.prefijoBus) || 'Bus';
          buses = Array.from({ length: n }, (_, i) => ({
            codigo: `${pref} ${i + 1}`,
            orden: i + 1,
            capacidad: cap,
            color: COLORES_BUS[i % COLORES_BUS.length].id,
            unidadId: null, interno: '', patente: '', empresa: 'SURCANTE', tipo: '',
            presentacion: '', notas: '',
          }));
        }
        const ref = await crearOperativo({ ...data, agenciaId: agencia.id, agenciaNombre: agencia.nombre }, buses);
        if (modo === 'excel' && excelDatos) {
          await importarMaestro(ref.id, excelDatos, {});
        }
        onCreado?.(ref.id);
      } else {
        await actualizarOperativo(operativo.id, data);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar. Revisá la conexión y los permisos de Firestore.');
      setGuardando(false);
    }
  }

  const F = { form, set: setForm };

  return (
    <Modal
      titulo={esNuevo ? `Nuevo operativo · ${agencia?.nombre || ''}` : `Editar ${operativo.nombre}`}
      onClose={onClose}
      footer={<>
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? (modo === 'excel' ? 'Creando e importando...' : 'Guardando...') : esNuevo ? (modo === 'excel' ? '✓ Crear e importar' : '✓ Crear operativo') : '✓ Guardar cambios'}
        </button>
      </>}>
      {esNuevo && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--eg-bg-2,rgba(255,255,255,.06))', padding: 4, borderRadius: 10 }}>
          {[['manual', '✍️ Manual'], ['excel', '📊 Desde Excel']].map(([m, label]) => (
            <button key={m} onClick={() => { setModo(m); if (m === 'manual') { setExcelDatos(null); setExcelError(''); } }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: modo === m ? 'var(--eg-accent,#7c3aed)' : 'transparent',
                color: modo === m ? '#fff' : 'var(--eg-text-2,#94a3b8)', transition: 'all .15s' }}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="eg-form-grid">
        <div className="eg-form-section full">Viaje</div>
        <Campo label="Nombre del operativo *" full hint="Así lo ven conductores, coordinadores y pasajeros.">
          <Input {...F} campo="nombre" placeholder="ej: Bariloche 2026 · Colegio San José" autoFocus={esNuevo} />
        </Campo>
        <Campo label="Destino"><Input {...F} campo="destino" placeholder="ej: San Carlos de Bariloche" /></Campo>
        <Campo label="Estado">
          <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
            {Object.entries(ESTADOS_OPERATIVO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Campo>
        <Campo label="Fecha de inicio"><Input {...F} campo="fechaInicio" type="date" /></Campo>
        <Campo label="Fecha de fin"><Input {...F} campo="fechaFin" type="date" /></Campo>
        <Campo label="Colegios / grupos"><Input {...F} campo="colegios" placeholder="ej: Esc. N°53, Colegio San José" /></Campo>
        <Campo label="Pasajeros estimados"><Input {...F} campo="pasajerosEstimados" type="number" min="0" /></Campo>

        {esNuevo && modo === 'manual' && <>
          <div className="eg-form-section full">Ómnibus (se pueden editar después)</div>
          <Campo label="Cantidad de ómnibus"><Input {...F} campo="cantidadBuses" type="number" min="0" max="40" /></Campo>
          <Campo label="Capacidad de cada uno"><Input {...F} campo="capacidadDefault" type="number" min="1" /></Campo>
          <Campo label="Identificación" hint={`Quedan como "${form.prefijoBus || 'Bus'} 1", "${form.prefijoBus || 'Bus'} 2"... cada uno con un color distinto.`} full>
            <Input {...F} campo="prefijoBus" placeholder="Bus" />
          </Campo>
        </>}
        {esNuevo && modo === 'excel' && <>
          <div className="eg-form-section full">Excel Maestro</div>
          <div className="full">
            <div
              style={{ border: `2px dashed ${excelDatos ? 'var(--eg-accent,#7c3aed)' : 'var(--eg-sep,rgba(255,255,255,.12))'}`,
                borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
                background: excelDatos ? 'rgba(124,58,237,.07)' : 'transparent', transition: 'all .15s' }}
              onClick={() => inputExcelRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); abrirExcel(e.dataTransfer.files?.[0]); }}>
              <div style={{ fontSize: 28 }}>{cargandoExcel ? '⏳' : excelDatos ? '✅' : '📊'}</div>
              <div style={{ fontWeight: 700, marginTop: 6, fontSize: 14, color: 'var(--eg-text)' }}>
                {cargandoExcel ? 'Leyendo archivo...' : excelDatos ? 'Excel cargado — tocá para cambiar' : 'Subí el Excel Maestro de Surcante'}
              </div>
              {!excelDatos && !cargandoExcel && (
                <div style={{ fontSize: 12, color: 'var(--eg-text-2)', marginTop: 4 }}>
                  Arrastrá o tocá para elegir el .xlsx — buses, conductores, coordinadores, pasajeros e itinerario se importan solos.
                </div>
              )}
              {excelDatos && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
                  {[['buses','🚌','Ómnibus'],['conductores','🧑‍✈️','Conductores'],['coordinadores','📋','Coordinadores'],['pasajeros','🎒','Pasajeros'],['itinerario','🗓️','Días']].map(([k,icon,label]) =>
                    excelDatos[k].length > 0 && (
                      <span key={k} className="eg-chip eg-chip-green" style={{ fontSize: 12 }}>
                        {icon} {excelDatos[k].length} {label}
                      </span>
                    )
                  )}
                </div>
              )}
              <input ref={inputExcelRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { abrirExcel(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {excelError && <div className="eg-alert eg-alert-error" style={{ marginTop: 8 }}>{excelError}</div>}
          </div>
        </>}

        <div className="eg-form-section full">Salida</div>
        <Campo label="Lugar de salida"><Input {...F} campo="salidaLugar" placeholder="ej: Puerta del colegio" /></Campo>
        <Campo label="Dirección"><Input {...F} campo="salidaDireccion" placeholder="Calle 123, Ciudad" /></Campo>
        <Campo label="Fecha de salida" hint="Si queda vacío, usa la fecha de inicio"><Input {...F} campo="salidaFecha" type="date" /></Campo>
        <Campo label="Hora de salida"><Input {...F} campo="salidaHora" type="time" /></Campo>
        <Campo label="Hora de presentación"><Input {...F} campo="salidaPresentacion" type="time" /></Campo>
        <Campo label="Indicaciones de salida" full>
          <TextArea {...F} campo="salidaIndicaciones" rows={2} placeholder="ej: Presentarse con DNI, valija de hasta 20 kg + bolso de mano" />
        </Campo>

        <div className="eg-form-section full">Regreso</div>
        <Campo label="Fecha de regreso"><Input {...F} campo="regresoFecha" type="date" /></Campo>
        <Campo label="Hora estimada de llegada"><Input {...F} campo="regresoHora" type="time" /></Campo>
        <Campo label="Lugar de llegada" full><Input {...F} campo="regresoLugar" placeholder="ej: Puerta del colegio" /></Campo>

        <div className="eg-form-section full">Contactos y comunicación</div>
        <Campo label="Contacto de la agencia en destino"><Input {...F} campo="contactoDestinoNombre" /></Campo>
        <Campo label="Teléfono contacto en destino"><Input {...F} campo="contactoDestinoTel" type="tel" /></Campo>
        <Campo label="Teléfono de emergencia Surcante" full><Input {...F} campo="telEmergencia" type="tel" placeholder="Guardia 24 h" /></Campo>
        <Campo label="Información general para pasajeros" full hint="Se muestra a todos los pasajeros: qué llevar, reglas, teléfonos útiles.">
          <TextArea {...F} campo="infoPasajeros" rows={4} />
        </Campo>
        <Campo label="Notas internas (solo admin)" full><TextArea {...F} campo="notasInternas" rows={2} /></Campo>
      </div>
      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}
