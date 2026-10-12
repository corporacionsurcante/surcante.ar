import './tokens.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Aplicar tema guardado antes de que React monte (evita flash)
try {
  const saved = localStorage.getItem('surcante-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
} catch (_) {}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
