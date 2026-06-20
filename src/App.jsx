import React, { useState } from 'react';
import Topbar from './components/Topbar';
import Steps from './components/Steps';
import SelectorServicio from './pages/SelectorServicio';
import PasoFlota from './pages/PasoFlota';
import PasoRecorrido from './pages/PasoRecorrido';
import PasoPresupuesto from './pages/PasoPresupuesto';
import Confirmacion from './pages/Confirmacion';
import ReceptivoCotizador from './pages/ReceptivoCotizador';
import AdminApp from './admin/pages/AdminApp';
import './index.css';

function CotizadorApp() {
  const [tipoServicio, setTipoServicio] = useState(null); // null | 'charter' | 'receptivo'
  const [step, setStep] = useState(1);
  const [reserva, setReserva] = useState(null);
  const [pago, setPago] = useState(null);

  function handleFlotaDone(data) { setReserva(prev => ({ ...prev, ...data })); setStep(2); }
  function handleRecorridoDone(data) { setReserva(prev => ({ ...prev, ...data })); setStep(3); }
  function handleConfirm(pagoData) { setPago(pagoData); setStep(4); }
  function handleNueva() { setReserva(null); setPago(null); setStep(1); setTipoServicio(null); }

  // Receptivo tiene su propio flujo completo
  if (tipoServicio === 'receptivo') {
    return (
      <div className="app-shell">
        <Topbar />
        <div style={{ padding: '10px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sp)', letterSpacing: '.05em', textTransform: 'uppercase' }}>🏛️ Receptivo</span>
        </div>
        <ReceptivoCotizador onBack={() => setTipoServicio(null)} />
      </div>
    );
  }

  // Charter — flujo existente
  if (tipoServicio === 'charter') {
    return (
      <div className="app-shell">
        <Topbar />
        <div style={{ padding: '10px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sp)', letterSpacing: '.05em', textTransform: 'uppercase' }}>🚌 Charter</span>
          <button onClick={() => { setTipoServicio(null); setStep(1); setReserva(null); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            ← Cambiar servicio
          </button>
        </div>
        {step < 4 && <Steps current={step} />}
        {step === 1 && <PasoFlota onNext={handleFlotaDone} />}
        {step === 2 && <PasoRecorrido reserva={reserva} onNext={handleRecorridoDone} onBack={() => setStep(1)} />}
        {step === 3 && <PasoPresupuesto reserva={reserva} onBack={() => setStep(2)} onConfirm={handleConfirm} />}
        {step === 4 && <Confirmacion reserva={reserva} pago={pago} onNueva={handleNueva} />}
      </div>
    );
  }

  // Pantalla inicial — selector de servicio
  return (
    <div className="app-shell">
      <Topbar />
      <SelectorServicio onSelect={setTipoServicio} />
    </div>
  );
}

export default function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  if (isAdmin) return <AdminApp />;
  return <CotizadorApp />;
}
