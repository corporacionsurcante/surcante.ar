import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase/config';
import './portal.css';

const PortalPasajero = lazy(() => import('./PortalPasajero'));
const PortalConductor = lazy(() => import('./PortalConductor'));
const PortalCoordinador = lazy(() => import('./PortalCoordinador'));

const FALLBACK = (
  <div className="portal-cargando">
    <div className="portal-spinner" />
    Cargando…
  </div>
);

export default function PortalViaje() {
  const [sesion, setSesion] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const token = useMemo(() => window.location.pathname.split('/')[2] || '', []);

  useEffect(() => {
    if (!token || token.length < 10) {
      setError('Link inválido. Pedile uno nuevo a tu agencia.');
      setCargando(false);
      return;
    }
    fetch('/api/acceso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(async d => {
        if (d.error) throw new Error(d.error);
        await signInWithCustomToken(auth, d.customToken);
        setSesion({
          token,
          rol: d.rol,
          opId: d.opId,
          refId: d.refId,
          busId: d.busId || null,
          nombre: d.nombre || '',
        });
      })
      .catch(e => setError(e.message || 'Error al cargar tu portal.'))
      .finally(() => setCargando(false));
  }, [token]);

  if (cargando) return (
    <div className="portal-cargando">
      <div className="portal-spinner" />
      Verificando acceso…
    </div>
  );

  if (error) return (
    <div className="portal-error-wrap">
      <div className="portal-error-card">
        <span className="portal-error-icon">🔗</span>
        <h2>No se pudo abrir tu portal</h2>
        <p>{error}</p>
        <p className="portal-error-hint">
          Si el error continúa, contactá a tu agencia para que te reenvíen el link.
        </p>
      </div>
    </div>
  );

  if (!sesion) return null;

  return (
    <Suspense fallback={FALLBACK}>
      {sesion.rol === 'pasajero'     && <PortalPasajero    sesion={sesion} />}
      {sesion.rol === 'conductor'    && <PortalConductor   sesion={sesion} />}
      {sesion.rol === 'coordinador'  && <PortalCoordinador sesion={sesion} />}
    </Suspense>
  );
}
