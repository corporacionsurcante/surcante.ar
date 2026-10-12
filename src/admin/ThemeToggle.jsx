import { useState, useEffect } from 'react';

function getStoredTheme() {
  try { return localStorage.getItem('surcante-theme') || 'light'; } catch { return 'light'; }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('surcante-theme', theme); } catch (_) {}
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 8,
        border: '1px solid var(--ad-sep)',
        background: 'transparent',
        color: 'var(--ad-text-2)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all .15s',
        whiteSpace: 'nowrap',
      }}
    >
      {isDark ? '☀️ Claro' : '🌙 Oscuro'}
    </button>
  );
}
