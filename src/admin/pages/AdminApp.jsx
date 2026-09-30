import React, { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { isAdminAutorizado } from '../../firebase/services';
import AdminLogin from './AdminLogin';
import Dashboard from './Dashboard';
import Reservas from './Reservas';
import Flota from './Flota';
import Precios from './Precios';
import Gantt from './Gantt';
import Receptivo from './Receptivo';
import ConfigModulos from './ConfigModulos';
import Cotizaciones from './Cotizaciones';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { marcarNotificacionesComoLeidas } from '../../firebase/notificacionesService';
import { activarNotificacionesPush, pushYaActivado } from '../../firebase/pushService';
import '../admin.css';

// Módulo Egresados: se carga bajo demanda para no agrandar el cotizador público
const Egresados = lazy(() => import('./Egresados'));

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',     icon: '📊' },
  { id: 'gantt',        label: 'Diagrama',      icon: '📅' },
  { id: 'reservas',     label: 'Reservas',      icon: '📋' },
  { id: 'cotizaciones', label: 'Cotizaciones',  icon: '📄' },
  { id: 'egresados',    label: 'Egresados',     icon: '🎓' },
  { id: 'flota',        label: 'Flota',         icon: '🚌' },
  { id: 'precios',      label: 'Precios',       icon: '💰' },
  { id: 'receptivo',    label: 'Receptivo',     icon: '🏛️' },
  { id: 'config',       label: 'Config',        icon: '⚙️' },
];

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sinAcceso, setSinAcceso] = useState('');
  const [errorVerificacion, setErrorVerificacion] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [notificacionesPendientes, setNotificacionesPendientes] = useState(0);
  const [pushActivo, setPushActivo] = useState(() => pushYaActivado());
  const [pushLoading, setPushLoading] = useState(false);

  // El admin se instala como app propia en iPhone/Android (manifest con start_url /admin)
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.href = '/manifest-admin.json';
    document.title = 'Surcante Admin';
  }, []);

  async function handleActivarPush() {
    setPushLoading(true);
    try {
      await activarNotificacionesPush(user?.email);
      setPushActivo(true);
      alert('🔔 ¡Notificaciones activadas! Vas a recibir un aviso en este dispositivo por cada cotización nueva.');
    } catch (e) {
      alert(e.message || 'No se pudieron activar las notificaciones.');
    }
    setPushLoading(false);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setErrorVerificacion('');
      if (!u) {
        setUser(null);
        setChecking(false);
        return;
      }
      try {
        const ok = await isAdminAutorizado(u.email);
        if (ok) {
          setUser(u);
          setSinAcceso('');
        } else {
          // Sesión de Google sin permiso de admin: se cierra y se avisa
          setUser(null);
          setSinAcceso(u.email || 'esta cuenta');
          signOut(auth).catch(() => {});
        }
      } catch (e) {
        console.error('Verificando admin:', e);
        setUser(null);
        setErrorVerificacion('No se pudo verificar tu acceso (sin conexión con la base de datos). Revisá internet y recargá la página.');
      } finally {
        setChecking(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, 'notificaciones'), where('leida', '==', false));
    return onSnapshot(q, snap => {
      setNotificacionesPendientes(snap.size);
    }, e => console.error('[Firestore] notificaciones:', e));
  }, [user]);

  useEffect(() => {
    if (tab !== 'reservas' || !user) return;
    marcarNotificacionesComoLeidas().catch(e => console.error('Marcando notificaciones:', e));
  }, [tab, user]);

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0F', color: 'rgba(255,255,255,.4)', fontSize: 14 }}>
      Verificando acceso...
    </div>
  );

  if (errorVerificacion) return (
    <div className="login-page">
      <div className="login-card">
        <img src="/Logo_Surcante_01.png" alt="Surcante" className="login-logo" />
        <div className="login-error" style={{ marginTop: 0 }}>{errorVerificacion}</div>
        <button className="login-btn" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    </div>
  );

  if (!user) return <AdminLogin onLogin={u => { setSinAcceso(''); setUser(u); }} sinAcceso={sinAcceso} />;

  const initials = user.displayName?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || (user.email || '?')[0].toUpperCase();

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <img src="/Logo_Surcante_01.png" alt="Surcante" className="admin-logo" />
          <span className="admin-badge">ADMIN</span>
        </div>
        <div className="admin-user">
          <button
            onClick={handleActivarPush}
            disabled={pushLoading || pushActivo}
            title={pushActivo ? 'Notificaciones activadas en este dispositivo' : 'Recibir notificaciones push de cotizaciones'}
            style={{
              border: pushActivo ? '1px solid #00C896' : '1px solid rgba(123,47,190,.5)',
              background: pushActivo ? 'rgba(0,200,150,.12)' : 'rgba(123,47,190,.15)',
              color: pushActivo ? '#00C896' : '#B58AE0',
              borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700,
              cursor: pushActivo ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
              marginRight: 8,
            }}>
            {pushLoading ? '...' : pushActivo ? '🔔 Activadas' : '🔔 Activar avisos'}
          </button>
          <div className="admin-avatar">{initials}</div>
          <span className="admin-email">{user.email}</span>
          <button className="admin-logout" onClick={() => signOut(auth)}>Salir</button>
        </div>
      </div>

      <div className="admin-nav">
        {NAV.map(n => (
          <div key={n.id} className={`admin-nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {n.id === 'reservas' && notificacionesPendientes > 0 && (
              <span style={{
                marginLeft: 8,
                background: '#CF1322',
                color: '#fff',
                borderRadius: 999,
                minWidth: 18,
                height: 18,
                padding: '0 6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {notificacionesPendientes}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className={tab === 'gantt' ? '' : 'admin-content'} style={tab === 'gantt' ? { padding: '20px 16px', overflowX: 'auto' } : {}}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'gantt'     && <Gantt />}
        {tab === 'reservas'  && <Reservas />}
        {tab === 'cotizaciones' && <Cotizaciones />}
        {tab === 'egresados' && (
          <Suspense fallback={<div className="admin-loading">Cargando módulo Egresados...</div>}>
            <Egresados />
          </Suspense>
        )}
        {tab === 'flota'     && <Flota />}
        {tab === 'precios'   && <Precios />}
        {tab === 'receptivo' && <Receptivo />}
        {tab === 'config'    && <ConfigModulos />}
      </div>
    </div>
  );
}
