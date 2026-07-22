import React, { useState, useEffect } from 'react';
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
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { marcarNotificacionesComoLeidas } from '../../firebase/notificacionesService';
import '../admin.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'gantt',     label: 'Diagrama',  icon: '📅' },
  { id: 'reservas',  label: 'Reservas',  icon: '📋' },
  { id: 'flota',     label: 'Flota',     icon: '🚌' },
  { id: 'precios',   label: 'Precios',   icon: '💰' },
  { id: 'receptivo', label: 'Receptivo', icon: '🏛️' },
  { id: 'config',    label: 'Config',    icon: '⚙️' },
];

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [notificacionesPendientes, setNotificacionesPendientes] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        const ok = await isAdminAutorizado(u.email);
        setUser(ok ? u : null);
      } else {
        setUser(null);
      }
      setChecking(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, 'notificaciones'), where('leida', '==', false));
    return onSnapshot(q, snap => {
      setNotificacionesPendientes(snap.size);
    });
  }, [user]);

  useEffect(() => {
    if (tab !== 'reservas') return;
    marcarNotificacionesComoLeidas();
  }, [tab]);

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0F', color: 'rgba(255,255,255,.4)', fontSize: 14 }}>
      Verificando acceso...
    </div>
  );

  if (!user) return <AdminLogin onLogin={setUser} />;

  const initials = user.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2) || user.email[0].toUpperCase();

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <img src="/Logo_Surcante_01.png" alt="Surcante" className="admin-logo" />
          <span className="admin-badge">ADMIN</span>
        </div>
        <div className="admin-user">
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
        {tab === 'flota'     && <Flota />}
        {tab === 'precios'   && <Precios />}
        {tab === 'receptivo' && <Receptivo />}
        {tab === 'config'    && <ConfigModulos />}
      </div>
    </div>
  );
}
