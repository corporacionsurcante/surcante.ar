import {
  calcularFindesLargos, evaluarTarifaDinamica, aplicarTarifaDinamica, ventanaTarifa,
  escalarDetalle, resumenTarifa, sumarDias, FERIADOS_SEMILLA,
} from './feriados';

const FERIADOS_2026 = [
  { fecha: '2026-03-23', nombre: 'Puente' }, { fecha: '2026-03-24', nombre: 'Memoria' },
  { fecha: '2026-04-02', nombre: 'Malvinas' },
  { fecha: '2026-07-09', nombre: 'Independencia' }, { fecha: '2026-07-10', nombre: 'Puente' },
  ...FERIADOS_SEMILLA,
];
const findes = calcularFindesLargos(FERIADOS_2026);
const rango = id => findes.find(f => f.id === id);

describe('fines de semana largos 2026', () => {
  test('detecta los del segundo semestre', () => {
    expect(rango('2026-10-10_2026-10-12')).toBeTruthy();
    expect(rango('2026-11-21_2026-11-23')).toBeTruthy();
    expect(rango('2026-12-05_2026-12-08').dias).toBe(4);
    expect(rango('2026-12-25_2026-12-27')).toBeTruthy();
    expect(rango('2026-07-09_2026-07-12').dias).toBe(4);
  });
  test('un feriado suelto en jueves (Malvinas) no es fin de semana largo', () => {
    expect(findes.some(f => f.desde <= '2026-04-02' && f.hasta >= '2026-04-02')).toBe(false);
  });
  test('Año Nuevo 2027 (viernes) forma fin de semana largo con Navidad aparte', () => {
    expect(rango('2027-01-01_2027-01-03')).toBeTruthy();
  });
  test('ignora fechas con formato inválido', () => {
    expect(calcularFindesLargos([{ fecha: 'mañana' }, null])).toEqual([]);
  });
});

describe('tarifa dinámica', () => {
  const cfg = { activa: true };
  const ev = (a, b, c = cfg) => evaluarTarifaDinamica({ fechaInicio: a, fechaFin: b, config: c, findes });

  test('apagada: nunca recarga', () => {
    expect(ev('2026-11-21', '2026-11-22', { activa: false }).aplica).toBe(false);
  });
  test('encendida: viaje dentro del fin de semana largo', () => {
    const r = ev('2026-11-21', '2026-11-22');
    expect(r.aplica).toBe(true);
    expect(r.multiplicador).toBe(2);
  });
  test('sale el viernes anterior (margen de 1 día por defecto)', () => {
    expect(ev('2026-11-20', '2026-11-20').aplica).toBe(true);
    expect(ev('2026-11-19', '2026-11-19').aplica).toBe(false);
  });
  test('el día siguiente al finde largo no recarga', () => {
    expect(ev('2026-11-24', '2026-11-25').aplica).toBe(false);
  });
  test('viaje que arranca antes y termina dentro del finde largo recarga', () => {
    expect(ev('2026-11-17', '2026-11-22').aplica).toBe(true);
  });
  test('sin fecha de regreso usa la de salida', () => {
    expect(ev('2026-10-11', '').aplica).toBe(true);
  });
  test('sin fecha de salida no recarga', () => {
    expect(ev('', '').aplica).toBe(false);
  });
  test('finde excluido desde el panel no recarga', () => {
    expect(ev('2026-11-21', '2026-11-22', { activa: true, excluidos: ['2026-11-21_2026-11-23'] }).aplica).toBe(false);
  });
  test('fechas extra cargadas a mano', () => {
    const c = { activa: true, fechasExtra: [{ desde: '2026-07-20', hasta: '2026-07-31', motivo: 'Vacaciones de invierno' }] };
    const r = ev('2026-07-25', '2026-07-26', c);
    expect(r.aplica).toBe(true);
    expect(r.motivo).toBe('Vacaciones de invierno');
  });
  test('multiplicador inválido vuelve a ×2', () => {
    expect(ev('2026-11-21', '2026-11-21', { activa: true, multiplicador: 0 }).multiplicador).toBe(2);
  });
  test('multiplicador configurable', () => {
    expect(ev('2026-11-21', '2026-11-21', { activa: true, multiplicador: 1.5 }).multiplicador).toBe(1.5);
  });
  test('aplicarTarifaDinamica duplica el total', () => {
    const r = aplicarTarifaDinamica(1000, { fechaInicio: '2026-10-11', config: cfg, findes });
    expect(r.total).toBe(2000);
    expect(r.recargo).toBe(1000);
    expect(r.base).toBe(1000);
  });
  test('margen configurable', () => {
    const v = ventanaTarifa({ desde: '2026-11-21', hasta: '2026-11-23' }, 2, 1);
    expect(v).toEqual({ desde: '2026-11-19', hasta: '2026-11-24' });
  });
});

describe('utilidades', () => {
  test('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('escalarDetalle mantiene subtotal + IVA = total', () => {
    const d = { subtotal: 1000, ivaTotal: 210, total: 1210, movNeto: 100, kmExtra: 5, label: 'x' };
    const e = escalarDetalle(d, 2);
    expect(e.subtotal + e.ivaTotal).toBeCloseTo(e.total, 6);
    expect(e.total).toBe(2420);
    expect(e.kmExtra).toBe(5); // lo que no es dinero no se toca
    expect(escalarDetalle(d, 1)).toBe(d);
  });
  test('resumenTarifa', () => {
    expect(resumenTarifa({ aplica: false }, 0)).toBeNull();
    expect(resumenTarifa({ aplica: true, multiplicador: 2, motivo: 'X' }, 1234.6))
      .toEqual({ aplica: true, multiplicador: 2, motivo: 'X', recargo: 1235 });
  });
});
