import React, { useEffect, useState } from 'react';
import { colorBus, ESTADOS_OPERATIVO } from './utils';

export function Modal({ titulo, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="eg-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className={`eg-modal ${wide ? 'wide' : ''}`}>
        <div className="eg-modal-head">
          <div className="eg-modal-title">{titulo}</div>
          <button className="eg-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="eg-modal-body">{children}</div>
        {footer && <div className="eg-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Campo({ label, hint, full, children }) {
  return (
    <div className={`eg-field ${full ? 'full' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

// Input controlado atado a un objeto form: <Input form={f} set={setF} campo="nombre" />
export function Input({ form, set, campo, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={form[campo] ?? ''}
      onChange={e => set(f => ({ ...f, [campo]: e.target.value }))}
      {...rest}
    />
  );
}

export function TextArea({ form, set, campo, rows = 3, ...rest }) {
  return (
    <textarea
      rows={rows}
      value={form[campo] ?? ''}
      onChange={e => set(f => ({ ...f, [campo]: e.target.value }))}
      {...rest}
    />
  );
}

export function BusChip({ bus, vacio = 'Sin asignar' }) {
  if (!bus) return <span className="eg-chip eg-chip-amber">{vacio}</span>;
  return (
    <span className="eg-bus-chip" style={{ background: colorBus(bus) }}>
      <span className="dot">🚌</span>{bus.codigo}
    </span>
  );
}

export function EstadoBadge({ estado }) {
  const e = ESTADOS_OPERATIVO[estado] || ESTADOS_OPERATIVO.planificacion;
  return <span className="eg-chip" style={{ background: e.bg, color: e.color }}>{e.label}</span>;
}

export function Vacio({ icono = '📭', children }) {
  return (
    <div className="eg-empty">
      <div className="eg-empty-icon">{icono}</div>
      {children}
    </div>
  );
}

export function BarraOcupacion({ usados, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((usados / total) * 100)) : 0;
  const color = usados > total ? '#CF1322' : pct >= 90 ? '#F57C00' : '#00A07A';
  return (
    <div className="eg-bar" title={`${usados} / ${total}`}>
      <div style={{ width: `${usados > total ? 100 : pct}%`, background: color }} />
    </div>
  );
}

// Botón de borrado con confirmación en dos pasos (sin window.confirm)
export function BotonEliminar({ onConfirm, texto = 'Eliminar', confirmar = '¿Confirmás?', small = false, disabled = false }) {
  const [paso, setPaso] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  useEffect(() => {
    if (!paso) return undefined;
    const t = setTimeout(() => setPaso(false), 4000);
    return () => clearTimeout(t);
  }, [paso]);
  const cls = `eg-btn eg-btn-danger ${small ? 'eg-btn-sm' : ''}`;
  if (!paso) return <button className={cls} disabled={disabled} onClick={() => setPaso(true)}>🗑️ {texto}</button>;
  return (
    <button
      className={cls}
      style={{ background: '#CF1322', color: '#fff' }}
      disabled={trabajando}
      onClick={async () => { setTrabajando(true); try { await onConfirm(); } finally { setTrabajando(false); setPaso(false); } }}>
      {trabajando ? 'Eliminando...' : confirmar}
    </button>
  );
}

// Toast simple: const [toast, mostrar] = useToast();  …  {toast}
export function useToast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(''), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg ? <div className="eg-toast">{msg}</div> : null, setMsg];
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
}

export function AvisoPermisos({ codigo }) {
  return (
    <div className="eg-section">
      <div className="eg-alert eg-alert-error">
        ⛔ Firestore no permite leer los datos de Egresados ({codigo}).
        Hay que agregar las reglas de las colecciones nuevas en Firebase Console → Firestore → Reglas
        (ver INSTRUCCIONES-EGRESADOS.md en el repositorio).
      </div>
    </div>
  );
}
