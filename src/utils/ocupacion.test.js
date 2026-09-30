import { turnosDeViaje, mapaCeldas, validarViaje, superposiciones, unidadLibre, addDays } from './ocupacion';

const v = (extra) => ({ id: 'a', unidadId: 'INT-201', desde: '2026-10-10', hasta: '2026-10-12', turnoSalida: 'M', turnoRegreso: 'T', ...extra });

describe('addDays', () => {
  test('cruza fin de mes y de año', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('turnosDeViaje', () => {
  test('viaje completo ocupa mañana y tarde de cada día', () => {
    expect(turnosDeViaje(v())).toHaveLength(6);
  });
  test('sale a la tarde y vuelve a la mañana: libera la mañana del primer día y la tarde del último', () => {
    const t = turnosDeViaje(v({ turnoSalida: 'T', turnoRegreso: 'M' })).map(x => `${x.fecha}_${x.turno}`);
    expect(t).not.toContain('2026-10-10_M');
    expect(t).toContain('2026-10-10_T');
    expect(t).toContain('2026-10-12_M');
    expect(t).not.toContain('2026-10-12_T');
  });
  test('viaje de un día a la mañana', () => {
    const t = turnosDeViaje(v({ hasta: '2026-10-10', turnoRegreso: 'M' }));
    expect(t).toEqual([{ fecha: '2026-10-10', turno: 'M' }]);
  });
  test('fechas invertidas no ocupan nada', () => {
    expect(turnosDeViaje(v({ desde: '2026-10-12', hasta: '2026-10-10' }))).toEqual([]);
  });
});

describe('mapaCeldas', () => {
  test('indexa por unidad, fecha y turno', () => {
    const c = mapaCeldas([v()]);
    expect(c['INT-201_2026-10-11_M'].id).toBe('a');
    expect(c['INT-104_2026-10-11_M']).toBeUndefined();
  });
});

describe('validarViaje', () => {
  test('regreso anterior a la salida', () => {
    expect(validarViaje({ desde: '2026-10-10', hasta: '2026-10-09', turnoSalida: 'M', turnoRegreso: 'T' })).toMatch(/anterior/);
  });
  test('mismo día tarde → mañana es inválido', () => {
    expect(validarViaje({ desde: '2026-10-10', hasta: '2026-10-10', turnoSalida: 'T', turnoRegreso: 'M' })).not.toBe('');
  });
  test('viaje válido', () => {
    expect(validarViaje(v())).toBe('');
  });
});

describe('superposiciones', () => {
  const existente = v({ id: 'x' });
  test('detecta choque en la misma unidad', () => {
    expect(superposiciones(v({ id: 'nuevo', desde: '2026-10-12', hasta: '2026-10-14' }), [existente])).toHaveLength(1);
  });
  test('no choca si uno vuelve a la mañana y el otro sale a la tarde el mismo día', () => {
    const a = v({ id: 'x', turnoRegreso: 'M' });
    const b = v({ id: 'nuevo', desde: '2026-10-12', hasta: '2026-10-14', turnoSalida: 'T' });
    expect(superposiciones(b, [a])).toHaveLength(0);
  });
  test('no choca con otra unidad ni consigo mismo', () => {
    expect(superposiciones(v({ id: 'nuevo', unidadId: 'INT-104' }), [existente])).toHaveLength(0);
    expect(superposiciones(v({ id: 'x' }), [existente])).toHaveLength(0);
  });
});

describe('unidadLibre (cotizador, días completos)', () => {
  const viajes = [v({ turnoRegreso: 'M' })];
  test('ocupada si el pedido toca cualquier turno del viaje', () => {
    expect(unidadLibre(viajes, 'INT-201', '2026-10-12', '2026-10-12')).toBe(false);
    expect(unidadLibre(viajes, 'INT-201', '2026-10-05', '2026-10-10')).toBe(false);
  });
  test('libre antes y después', () => {
    expect(unidadLibre(viajes, 'INT-201', '2026-10-13', '2026-10-15')).toBe(true);
    expect(unidadLibre(viajes, 'INT-201', '2026-10-01', '2026-10-09')).toBe(true);
  });
  test('otra unidad siempre libre', () => {
    expect(unidadLibre(viajes, 'INT-104', '2026-10-10', '2026-10-12')).toBe(true);
  });
});
