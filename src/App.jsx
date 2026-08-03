import React, { useState, useEffect } from 'react';
import Topbar from './components/Topbar';
import Steps from './components/Steps';
import SelectorServicio from './pages/SelectorServicio';
import PasoFlota from './pages/PasoFlota';
import PasoRecorrido from './pages/PasoRecorrido';
import PasoPresupuesto from './pages/PasoPresupuesto';
import Confirmacion from './pages/Confirmacion';
import ReceptivoCotizador from './pages/ReceptivoCotizador';
import DisponibilidadCotizador from './pages/DisponibilidadCotizador';
import MovimientosCotizador from './pages/MovimientosCotizador';
import AdminApp from './admin/pages/AdminApp';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { isAdminAutorizado } from './firebase/services';
import { WHATSAPP } from './data/pagos';
import './index.css';
import FooterLegal from './components/FooterLegal';
import bgImage from './assets/bg-surcante.jpg';

const ACCESO_STORAGE_KEY = 'surcante_acceso_cliente';

function leerAccesoGuardado() {
  try {
    const raw = window.localStorage.getItem(ACCESO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.nombreCompleto || !data?.whatsapp) return null;
    // Expirar sesión a los 30 días
    if (data.ts && Date.now() - data.ts > 30 * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(ACCESO_STORAGE_KEY);
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

function CotizadorApp() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [tipoServicio, setTipoServicio] = useState(null);
  const [accesoCliente, setAccesoCliente] = useState(() => leerAccesoGuardado());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        const ok = await isAdminAutorizado(u.email);
        setIsAdmin(ok);
      } else {
        setIsAdmin(false);
      }
    });
    return unsub;
  }, []); // null | 'charter' | 'receptivo'
  const [step, setStep] = useState(1);
  const [reserva, setReserva] = useState(null);
  const [pago, setPago] = useState(null);

  function handleFlotaDone(data) { setReserva(prev => ({ ...prev, ...data })); setStep(2); }
  function handleRecorridoDone(data) { setReserva(prev => ({ ...prev, ...data })); setStep(3); }
  function handleConfirm(pagoData) { setPago(pagoData); setStep(4); }
  function handleNueva() { setReserva(null); setPago(null); setStep(1); setTipoServicio(null); }
  function handleAccesoConfirmado(data) {
    const withTs = { ...data, ts: Date.now() };
    setAccesoCliente(withTs);
    window.localStorage.setItem(ACCESO_STORAGE_KEY, JSON.stringify(withTs));
  }

  if (!accesoCliente) {
    return (
      <>
        <BgOverlay />
        <div className="app-shell">
          <Topbar />
          <AccesoPrevio onConfirm={handleAccesoConfirmado} />
          <FooterLegal />
        </div>
      </>
    );
  }

  // Receptivo tiene su propio flujo completo
  if (tipoServicio === 'movimientos') {
    return (
      <>
        <BgOverlay />
        <div className="app-shell">
          <Topbar onHome={() => setTipoServicio(null)} />
          <MovimientosCotizador onBack={() => setTipoServicio(null)} initialContacto={accesoCliente} />
        </div>
      </>
    );
  }

  if (tipoServicio === 'disponibilidad') {
    return (
      <>
        <BgOverlay />
        <div className="app-shell">
          <Topbar onHome={() => setTipoServicio(null)} />
          <DisponibilidadCotizador onBack={() => setTipoServicio(null)} initialContacto={accesoCliente} />
        </div>
      </>
    );
  }

  if (tipoServicio === 'receptivo') {
    return (
      <>
        <BgOverlay />
        <div className="app-shell">
          <Topbar onHome={() => setTipoServicio(null)} />
          <ReceptivoCotizador onBack={() => setTipoServicio(null)} initialContacto={accesoCliente} />
        </div>
      </>
    );
  }

  // Charter — flujo existente
  if (tipoServicio === 'charter') {
    return (
      <>
        <BgOverlay />
        <div className="app-shell">
          <Topbar onHome={() => { setTipoServicio(null); setStep(1); setReserva(null); }} />
          {step < 4 && <Steps current={step} />}
          {step === 1 && <PasoFlota onNext={handleFlotaDone} />}
          {step === 2 && <PasoRecorrido reserva={reserva} onNext={handleRecorridoDone} onBack={() => setStep(1)} />}
          {step === 3 && <PasoPresupuesto reserva={reserva} onBack={() => setStep(2)} onConfirm={handleConfirm} isAdmin={isAdmin} initialContacto={accesoCliente} />}
          {step === 4 && <Confirmacion reserva={reserva} pago={pago} onNueva={handleNueva} />}
        </div>
      </>
    );
  }

  // Pantalla inicial — selector de servicio
  return (
    <>
      <BgOverlay />
      <div className="app-shell">
        <Topbar />
        <SelectorServicio onSelect={setTipoServicio} />
        <FooterLegal />
      </div>
    </>
  );
}

function BgOverlay() {
  return (
    <div id="bg-overlay" style={{ backgroundImage: `url(${bgImage})` }} />
  );
}

const MP_STATUS_CONFIG = {
  exitoso:  { icon: '✅', title: '¡Pago recibido!', sub: 'Tu seña fue procesada. Te contactamos a la brevedad para confirmar la reserva.', color: '#00C896' },
  fallido:  { icon: '❌', title: 'El pago no se procesó', sub: 'Podés intentar con otro método o contactarnos directamente por WhatsApp.', color: '#CF1322' },
  pendiente:{ icon: '⏳', title: 'Pago pendiente', sub: 'Tu pago está siendo procesado. Te avisamos cuando esté acreditado.', color: '#FA8C16' },
};

function RetornoPago({ tipo, urlParams }) {
  const cfg = MP_STATUS_CONFIG[tipo] || MP_STATUS_CONFIG.pendiente;
  const paymentId = urlParams.get('payment_id') || urlParams.get('collection_id');
  return (
    <>
      <BgOverlay />
      <div className="app-shell">
        <Topbar />
        <div className="confirm-page">
          <div className="confirm-icon">{cfg.icon}</div>
          <div className="confirm-title">{cfg.title}</div>
          <div className="confirm-sub">{cfg.sub}</div>
          {paymentId && (
            <div style={{ background: '#F4F2FA', borderRadius: 10, padding: '8px 14px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#9090B0', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>ID de pago</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#7B2FBE' }}>{paymentId}</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {WHATSAPP.map(w => (
              <a key={w.numero}
                href={`https://wa.me/${w.numero}?text=${encodeURIComponent(`Hola ${w.nombre}! Acabo de realizar un pago (ID: ${paymentId || 'N/D'}) en Surcante. ¿Pueden confirmar mi reserva?`)}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', background: '#25D366', borderRadius: 10, color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13, gap: 4, textAlign: 'center' }}>
                <span style={{ fontSize: 20 }}>📱</span>
                {w.label}
              </a>
            ))}
          </div>
          <a href="/" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary" style={{ width: '100%' }}>← Volver al inicio</button>
          </a>
        </div>
      </div>
    </>
  );
}

function AccesoPrevio({ onConfirm }) {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');

  function normalizarWhatsapp(text) {
    return text.replace(/[^\d+]/g, '').trim();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nombre = nombreCompleto.trim();
    const wa = normalizarWhatsapp(whatsapp);
    if (nombre.length < 5 || !nombre.includes(' ')) {
      setError('Ingresá nombre y apellido.');
      return;
    }
    if (wa.replace(/\D/g, '').length < 8) {
      setError('Ingresá un WhatsApp válido.');
      return;
    }
    setError('');
    onConfirm({ nombreCompleto: nombre, whatsapp: wa });
  }

  return (
    <div className="body">
      <div className="section-label">Acceso al cotizador</div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Antes de continuar</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Para ingresar y generar consultas/cotizaciones necesitamos tus datos de contacto.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>Nombre y apellido</div>
          <input
            type="text"
            placeholder="ej: Juan García"
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>WhatsApp</div>
          <input
            type="tel"
            placeholder="ej: 11 1234 5678"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>
        {error && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--red-text)', background: 'var(--red-bg)', borderRadius: 8, padding: '8px 10px' }}>
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary" style={{ marginTop: 0 }}>
          Ingresar al cotizador →
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/admin')) return <AdminApp />;
  const urlParams = new URLSearchParams(window.location.search);
  if (pathname === '/pago-exitoso') return <RetornoPago tipo="exitoso" urlParams={urlParams} />;
  if (pathname === '/pago-fallido') return <RetornoPago tipo="fallido" urlParams={urlParams} />;
  if (pathname === '/pago-pendiente') return <RetornoPago tipo="pendiente" urlParams={urlParams} />;
  return <CotizadorApp />;
}
