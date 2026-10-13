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
  const [needsPin, setNeedsPin] = useState(false);
  const [pinRol, setPinRol] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [verificandoPin, setVerificandoPin] = useState(false);

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
        if (d.requiresPin) {
          setNeedsPin(true);
          setPinRol(d.rol || '');
          return;
        }
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

  async function handleVerificarPin(e) {
    e.preventDefault();
    if (pinInput.length !== 6) return;
    setVerificandoPin(true);
    setPinError('');
    try {
      const r = await fetch('/api/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: pinInput }),
      });
      const d = await r.json();
      if (d.error) { setPinError(d.error); return; }
      await signInWithCustomToken(auth, d.customToken);
      setNeedsPin(false);
      setSesion({
        token,
        rol: d.rol,
        opId: d.opId,
        refId: d.refId,
        busId: d.busId || null,
        nombre: d.nombre || '',
      });
    } catch (err) {
      setPinError(err.message || 'Error al verificar el código.');
    } finally {
      setVerificandoPin(false);
    }
  }

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

  if (needsPin) {
    const rolIcon = pinRol === 'conductor' ? '🧑‍✈️' : '📋';
    const rolLabel = pinRol === 'conductor' ? 'Conductor' : 'Coordinador';
    return (
      <div className="portal-error-wrap">
        <div className="portal-error-card">
          <span className="portal-error-icon">{rolIcon}</span>
          <h2>Ingresá tu código de acceso</h2>
          <p style={{ color: 'var(--portal-text-2, #94a3b8)', marginBottom: 20 }}>
            Tu acceso de {rolLabel} está protegido. Ingresá el código de 6 dígitos que te enviaron.
          </p>
          <form onSubmit={handleVerificarPin} style={{ width: '100%' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
              style={{
                width: '100%', boxSizing: 'border-box',
                textAlign: 'center', letterSpacing: 10, fontSize: 28, fontFamily: 'monospace',
                padding: '14px 16px', marginBottom: 8, borderRadius: 12,
                border: `2px solid ${pinError ? '#ef4444' : 'var(--portal-sep, rgba(255,255,255,.12))'}`,
                background: 'var(--portal-bg-2, rgba(255,255,255,.06))',
                color: 'var(--portal-text, #fff)', outline: 'none',
              }}
              autoFocus
              autoComplete="one-time-code"
              disabled={verificandoPin}
            />
            {pinError && (
              <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0 10px', textAlign: 'center' }}>
                {pinError}
              </p>
            )}
            <button
              type="submit"
              disabled={verificandoPin || pinInput.length !== 6}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                background: pinInput.length === 6 ? 'var(--portal-accent, #7c3aed)' : 'rgba(124,58,237,.3)',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: pinInput.length === 6 ? 'pointer' : 'default',
                transition: 'background .2s',
              }}
            >
              {verificandoPin ? 'Verificando…' : 'Ingresar →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!sesion) return null;

  return (
    <Suspense fallback={FALLBACK}>
      {sesion.rol === 'pasajero'     && <PortalPasajero    sesion={sesion} />}
      {sesion.rol === 'conductor'    && <PortalConductor   sesion={sesion} />}
      {sesion.rol === 'coordinador'  && <PortalCoordinador sesion={sesion} />}
      {!['pasajero', 'conductor', 'coordinador'].includes(sesion.rol) && (
        <div className="portal-error-wrap">
          <div className="portal-error-card">
            <span className="portal-error-icon">⚠️</span>
            <h2>Rol desconocido</h2>
            <p>Tu link de acceso tiene un tipo de usuario no reconocido. Contactá a tu agencia.</p>
          </div>
        </div>
      )}
    </Suspense>
  );
}
