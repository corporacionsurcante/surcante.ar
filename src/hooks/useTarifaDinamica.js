import { useEffect, useMemo, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  CONFIG_TARIFA_DEFAULT,
  FERIADOS_SEMILLA,
  calcularFindesLargos,
  evaluarTarifaDinamica,
  aplicarTarifaDinamica,
} from '../utils/feriados';

// Lee en tiempo real:
//   config/tarifaDinamica -> botón, multiplicador, márgenes, exclusiones (lo edita el admin)
//   config/feriadosAR     -> calendario oficial (lo actualiza la tarea mensual /api/actualizar-feriados)
export function useTarifaDinamica() {
  const [config, setConfig] = useState(CONFIG_TARIFA_DEFAULT);
  const [calendario, setCalendario] = useState({ feriados: [], fuente: '', actualizadoEn: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let listos = 0;
    const listo = () => { listos += 1; if (listos >= 2) setLoading(false); };
    const u1 = onSnapshot(doc(db, 'config', 'tarifaDinamica'), snap => {
      setConfig({ ...CONFIG_TARIFA_DEFAULT, ...(snap.exists() ? snap.data() : {}) });
      listo();
    }, () => listo());
    const u2 = onSnapshot(doc(db, 'config', 'feriadosAR'), snap => {
      if (snap.exists()) setCalendario({ feriados: [], fuente: '', actualizadoEn: '', ...snap.data() });
      listo();
    }, () => listo());
    // Si Firestore tarda demasiado se cotiza igual (sin recargo) para no dejar la pantalla trabada
    const tope = setTimeout(() => setLoading(false), 5000);
    return () => { u1(); u2(); clearTimeout(tope); };
  }, []);

  const feriados = calendario.feriados?.length ? calendario.feriados : FERIADOS_SEMILLA;
  const findes = useMemo(() => calcularFindesLargos(feriados), [feriados]);

  const evaluar = useCallback(
    (fechaInicio, fechaFin) => evaluarTarifaDinamica({ fechaInicio, fechaFin, config, findes }),
    [config, findes]
  );
  const aplicar = useCallback(
    (total, fechaInicio, fechaFin) => aplicarTarifaDinamica(total, { fechaInicio, fechaFin, config, findes }),
    [config, findes]
  );

  return { config, calendario, feriados, findes, loading, evaluar, aplicar };
}
