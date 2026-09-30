import React, { useState } from 'react';
import { signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase/config';
import { isAdminAutorizado } from '../../firebase/services';

// Mensaje claro según el código de error de Firebase Auth
function mensajeLogin(e) {
  const code = e?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return `Este dominio (${window.location.hostname}) no está autorizado para iniciar sesión. Agregalo en Firebase Console → Authentication → Configuración → Dominios autorizados.`;
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Se cerró la ventana de Google antes de terminar. Intentá de nuevo.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Sin conexión con Google. Revisá internet e intentá de nuevo.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Demasiados intentos seguidos. Esperá unos minutos y volvé a probar.';
  }
  if (code === 'auth/user-disabled') {
    return 'Esta cuenta de Google está deshabilitada en Firebase.';
  }
  return `Error al iniciar sesión${code ? ` (${code})` : ''}. Intentá de nuevo.`;
}

export default function AdminLogin({ onLogin, sinAcceso }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;
      const autorizado = await isAdminAutorizado(email);
      if (!autorizado) {
        await signOut(auth);
        setError(`La cuenta ${email} no tiene acceso al panel de administración.`);
        setLoading(false);
        return;
      }
      onLogin(result.user);
    } catch (e) {
      console.error('Login admin:', e);
      // Navegadores o apps instaladas que bloquean ventanas emergentes → redirección
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (e2) {
          console.error('Login admin (redirect):', e2);
          setError(mensajeLogin(e2));
          setLoading(false);
          return;
        }
      }
      setError(mensajeLogin(e));
      setLoading(false);
    }
  }

  const aviso = error || (sinAcceso ? `La cuenta ${sinAcceso} no tiene acceso al panel de administración. Ingresá con una cuenta autorizada.` : '');

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/Logo_Surcante_01.png" alt="Surcante" className="login-logo" />
        <div className="login-title">Panel de administración</div>
        <div className="login-sub">Acceso exclusivo para el equipo Surcante</div>
        <button className="login-btn" onClick={handleGoogleLogin} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Iniciando sesión...' : 'Ingresar con Google'}
        </button>
        {aviso && <div className="login-error">{aviso}</div>}
      </div>
    </div>
  );
}
