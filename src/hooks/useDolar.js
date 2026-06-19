import { useState, useEffect } from 'react';

export function useDolar() {
  const [dolar, setDolar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchDolar() {
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        setDolar(data.venta);
      } catch (e) {
        setError(true);
        // fallback razonable para no bloquear la app
        setDolar(1230);
      } finally {
        setLoading(false);
      }
    }
    fetchDolar();
    // refrescar cada 10 minutos
    const interval = setInterval(fetchDolar, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { dolar, loading, error };
}
