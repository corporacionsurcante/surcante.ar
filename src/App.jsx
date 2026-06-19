import React, { useState } from 'react';
import Topbar from './components/Topbar';
import Steps from './components/Steps';
import PasoFlota from './pages/PasoFlota';
import PasoRecorrido from './pages/PasoRecorrido';
import PasoPresupuesto from './pages/PasoPresupuesto';
import Confirmacion from './pages/Confirmacion';
import AdminApp from './admin/pages/AdminApp';
import './index.css';

export default function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  if (isAdmin) return <AdminApp />;

  const [step, setStep] = useState(1);
  const [reserva, setReserva] = useState(null);
  const [pago, setPago] = useState(null);

  function handleFlotaDone(data) { setReserva(prev => ({ ...prev, ...data })); setStep(2); }
  function handleRecorridoDone(data) { setReserva(prev => ({ ...prev, ...data })); setStep(3); }
  function handleConfirm(pagoData) { setPago(pagoData); setStep(4); }
  function handleNueva() { setReserva(null); setPago(null); setStep(1); }

  return (
    <div className="app-shell">
      <Topbar />
      {step < 4 && <Steps current={step} />}
      {step === 1 && <PasoFlota onNext={handleFlotaDone} />}
      {step === 2 && <PasoRecorrido reserva={reserva} onNext={handleRecorridoDone} onBack={() => setStep(1)} />}
      {step === 3 && <PasoPresupuesto reserva={reserva} onBack={() => setStep(2)} onConfirm={handleConfirm} />}
      {step === 4 && <Confirmacion reserva={reserva} pago={pago} onNueva={handleNueva} />}
    </div>
  );
}
