import React, { useState } from 'react';
import { Modal, Campo, Input, TextArea } from './ui';
import { crearOperativo, actualizarOperativo } from '../../firebase/egresadosService';
import { COLORES_BUS, ESTADOS_OPERATIVO } from './utils';

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

  async function guardar() {
    if (!form.nombre.trim()) { setError('Poné un nombre al operativo (ej: Bariloche 2026 · Colegio San José).'); return; }
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) { setError('La fecha de fin es anterior a la de inicio.'); return; }
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
        const n = Math.max(0, Math.min(40, parseInt(form.cantidadBuses, 10) || 0));
        const cap = parseInt(form.capacidadDefault, 10) || 60;
        const pref = t(form.prefijoBus) || 'Bus';
        const buses = Array.from({ length: n }, (_, i) => ({
          codigo: `${pref} ${i + 1}`,
          orden: i + 1,
          capacidad: cap,
          color: COLORES_BUS[i % COLORES_BUS.length].id,
          unidadId: null, interno: '', patente: '', empresa: 'SURCANTE', tipo: '',
          presentacion: '', notas: '',
        }));
        const ref = await crearOperativo({ ...data, agenciaId: agencia.id, agenciaNombre: agencia.nombre }, buses);
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
          {guardando ? 'Guardando...' : esNuevo ? '✓ Crear operativo' : '✓ Guardar cambios'}
        </button>
      </>}>
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

        {esNuevo && <>
          <div className="eg-form-section full">Ómnibus (se pueden editar después)</div>
          <Campo label="Cantidad de ómnibus"><Input {...F} campo="cantidadBuses" type="number" min="0" max="40" /></Campo>
          <Campo label="Capacidad de cada uno"><Input {...F} campo="capacidadDefault" type="number" min="1" /></Campo>
          <Campo label="Identificación" hint={`Quedan como "${form.prefijoBus || 'Bus'} 1", "${form.prefijoBus || 'Bus'} 2"... cada uno con un color distinto.`} full>
            <Input {...F} campo="prefijoBus" placeholder="Bus" />
          </Campo>
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
