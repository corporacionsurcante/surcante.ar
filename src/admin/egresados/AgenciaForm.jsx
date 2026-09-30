import React, { useState } from 'react';
import { Modal, Campo, Input, TextArea } from './ui';
import { crearAgencia, actualizarAgencia } from '../../firebase/egresadosService';

const VACIO = {
  nombre: '', razonSocial: '', cuit: '', legajoEVT: '',
  contactoNombre: '', telefono: '', email: '',
  direccion: '', localidad: '', provincia: '', notas: '',
};

export default function AgenciaForm({ agencia, onClose, onGuardada }) {
  const [form, setForm] = useState(() => ({ ...VACIO, ...(agencia || {}) }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre de la agencia es obligatorio.'); return; }
    setGuardando(true);
    setError('');
    const data = {};
    Object.keys(VACIO).forEach(k => { data[k] = String(form[k] ?? '').trim(); });
    try {
      if (agencia?.id) {
        await actualizarAgencia(agencia.id, data);
        onGuardada?.(agencia.id);
      } else {
        const ref = await crearAgencia(data);
        onGuardada?.(ref.id);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar. Revisá la conexión y los permisos de Firestore.');
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={agencia?.id ? `Editar ${agencia.nombre}` : 'Nueva agencia de egresados'}
      onClose={onClose}
      footer={<>
        <button className="eg-btn eg-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="eg-btn eg-btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : '✓ Guardar agencia'}
        </button>
      </>}>
      <div className="eg-form-grid">
        <div className="eg-form-section full">Datos de la agencia</div>
        <Campo label="Nombre comercial *" full>
          <Input form={form} set={setForm} campo="nombre" placeholder="ej: Travel Dance" autoFocus />
        </Campo>
        <Campo label="Razón social"><Input form={form} set={setForm} campo="razonSocial" /></Campo>
        <Campo label="CUIT"><Input form={form} set={setForm} campo="cuit" placeholder="30-12345678-9" /></Campo>
        <Campo label="Legajo EVT" hint="Número de legajo del Ministerio de Turismo"><Input form={form} set={setForm} campo="legajoEVT" /></Campo>

        <div className="eg-form-section full">Contacto</div>
        <Campo label="Persona de contacto"><Input form={form} set={setForm} campo="contactoNombre" /></Campo>
        <Campo label="Teléfono / WhatsApp"><Input form={form} set={setForm} campo="telefono" type="tel" placeholder="11 1234 5678" /></Campo>
        <Campo label="Email" full><Input form={form} set={setForm} campo="email" type="email" /></Campo>
        <Campo label="Dirección" full><Input form={form} set={setForm} campo="direccion" /></Campo>
        <Campo label="Localidad"><Input form={form} set={setForm} campo="localidad" /></Campo>
        <Campo label="Provincia"><Input form={form} set={setForm} campo="provincia" /></Campo>
        <Campo label="Notas internas" full><TextArea form={form} set={setForm} campo="notas" /></Campo>
      </div>
      {error && <div className="eg-alert eg-alert-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}
