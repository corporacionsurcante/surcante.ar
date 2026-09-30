import { useEffect, useState } from 'react';
import { suscribirPrecios } from '../firebase/services';
import { normalizarParametros, PARAMETROS_DEFAULT } from '../utils/parametros';

// Parámetros generales (IVA, seña, umbrales de km) desde Admin → Precios.
// Si no se pueden leer, se cotiza con los valores por defecto.
export function useParametros() {
  const [params, setParams] = useState(PARAMETROS_DEFAULT);
  const [cargando, setCargando] = useState(true);

  useEffect(() => suscribirPrecios(
    data => { setParams(normalizarParametros(data)); setCargando(false); },
    () => { setParams(PARAMETROS_DEFAULT); setCargando(false); },
  ), []);

  return { params, cargando };
}
