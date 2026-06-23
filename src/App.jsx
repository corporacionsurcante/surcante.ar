import React, { useState } from 'react';
import Topbar from './components/Topbar';
import Steps from './components/Steps';
import SelectorServicio from './pages/SelectorServicio';
import PasoFlota from './pages/PasoFlota';
import PasoRecorrido from './pages/PasoRecorrido';
import PasoPresupuesto from './pages/PasoPresupuesto';
import Confirmacion from './pages/Confirmacion';
import ReceptivoCotizador from './pages/ReceptivoCotizador';
import DisponibilidadCotizador from './pages/DisponibilidadCotizador';
import AdminApp from './admin/pages/AdminApp';
import { useState as useAuthState, useEffect as useAuthEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { isAdminAutorizado } from './firebase/services';
import './index.css';

function CotizadorApp() {
  const [isAdmin, setIsAdmin] = useAuthState(false);
  const [tipoServicio, setTipoServicio] = useState(null);

  useAuthEffect(() => {
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

  // Receptivo tiene su propio flujo completo
  if (tipoServicio === 'disponibilidad') {
    return (
      <div className="app-shell">
        <Topbar onHome={() => setTipoServicio(null)} />
        <DisponibilidadCotizador onBack={() => setTipoServicio(null)} />
      </div>
    );
  }

  if (tipoServicio === 'receptivo') {
    return (
      <div className="app-shell">
        <Topbar onHome={() => setTipoServicio(null)} />
        <ReceptivoCotizador onBack={() => setTipoServicio(null)} />
      </div>
    );
  }

  // Charter — flujo existente
  if (tipoServicio === 'charter') {
    return (
      <div className="app-shell">
        <Topbar onHome={() => { setTipoServicio(null); setStep(1); setReserva(null); }} />
        {step < 4 && <Steps current={step} />}
        {step === 1 && <PasoFlota onNext={handleFlotaDone} />}
        {step === 2 && <PasoRecorrido reserva={reserva} onNext={handleRecorridoDone} onBack={() => setStep(1)} />}
        {step === 3 && <PasoPresupuesto reserva={reserva} onBack={() => setStep(2)} onConfirm={handleConfirm} isAdmin={isAdmin} />}
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
