import { useState, useEffect } from 'react';

const CACHE_KEY = 'surcante_dolar_oficial';
const FALLBACK_DOLAR = 1230; // último recurso si nunca se pudo consultar
const CACHE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

function leerCache() {
  try {
    const c = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.venta > 0 && Date.now() - c.ts < CACHE_MAX_MS) return c.venta;
  } catch (_) { /* noop */ }
  return null;
}

function guardarCache(venta) {
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ venta, ts: Date.now() })); } catch (_) { /* noop */ }
}

// Dólar oficial (venta). Si la API falla usa el último valor obtenido en este
// dispositivo y marca `error` para que la pantalla lo avise.
export function useDolar() {
  const [dolar, setDolar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    async function fetchDolar() {
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const venta = Number(data?.venta);
        if (!(venta > 0)) throw new Error('Respuesta sin cotización');
        guardarCache(venta);
        if (activo) { setDolar(venta); setError(false); }
      } catch (e) {
        console.error('No se pudo obtener el dólar oficial:', e);
        if (activo) {
          setError(true);
          setDolar(prev => prev || leerCache() || FALLBACK_DOLAR);
        }
      } finally {
        if (activo) setLoading(false);
      }
    }
    fetchDolar();
    // refrescar cada 10 minutos
    const interval = setInterval(fetchDolar, 10 * 60 * 1000);
    return () => { activo = false; clearInterval(interval); };
  }, []);

  return { dolar, loading, error };
}
