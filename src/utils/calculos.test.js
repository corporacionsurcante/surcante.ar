import { precioMovimientosDiaUSD, calcPrecioUnidad, calcPrecioUnidadConMinimo } from './calculos';
import { normalizarParametros, PARAMETROS_DEFAULT, porcentajeSena, fmtPorc, metodosPago } from './parametros';

const MIX = [303.69, 269.94, 236.20];
const cerca = (a, b) => expect(a).toBeCloseTo(b, 2);

describe('movimientos en destino: el día suma cada movimiento', () => {
  test('1, 2, 3 y 4 movimientos', () => {
    cerca(precioMovimientosDiaUSD(MIX, 0), 0);
    cerca(precioMovimientosDiaUSD(MIX, 1), 303.69);
    cerca(precioMovimientosDiaUSD(MIX, 2), 573.63);
    cerca(precioMovimientosDiaUSD(MIX, 3), 809.83);
    cerca(precioMovimientosDiaUSD(MIX, 4), 1046.03);
  });
  test('más movimientos nunca sale más barato', () => {
    for (let n = 1; n < 8; n++) {
      expect(precioMovimientosDiaUSD(MIX, n + 1)).toBeGreaterThan(precioMovimientosDiaUSD(MIX, n));
    }
  });
  test('valores faltantes cuentan 0', () => {
    cerca(precioMovimientosDiaUSD(undefined, 2), 0);
    cerca(precioMovimientosDiaUSD([100], 2), 100);
  });
});

describe('calcPrecioUnidad', () => {
  const unit = { usdKm: 2, movUSD: MIX, movDesc: 0 };
  test('suma movimientos por día, km extra e IVA configurable', () => {
    const r = calcPrecioUnidad({ unit, kmTotal: 100, movPorDia: [2, 0, 1], movKmPorDia: [200, 0, 10], dolar: 1, params: { ...PARAMETROS_DEFAULT, iva: 0.105 } });
    cerca(r.traslNeto, 200);
    // 573.63 + 303.69 + 50 km extra × 2
    cerca(r.movNeto, 573.63 + 303.69 + 100);
    expect(r.kmExtra).toBe(50);
    cerca(r.ivaTotal, r.subtotal * 0.105);
  });
  test('km incluidos configurables', () => {
    const r = calcPrecioUnidad({ unit, kmTotal: 0, movPorDia: [1], movKmPorDia: [200], dolar: 1, params: { ...PARAMETROS_DEFAULT, kmMovIncluidos: 250 } });
    expect(r.kmExtra).toBe(0);
  });
  test('descuento de movimientos', () => {
    const r = calcPrecioUnidad({ unit: { ...unit, movDesc: 0.2 }, kmTotal: 0, movPorDia: [1], movKmPorDia: [0], dolar: 1 });
    cerca(r.movNeto, 303.69 * 0.8);
  });
});

describe('calcPrecioUnidadConMinimo usa los umbrales configurados', () => {
  const unit = { usdKm: 2, movUSD: MIX, movDesc: 0, valorBaseUSD: 500, tipoNombre: 'MIX 60' };
  test('con umbral 300 un viaje de 400 km es larga distancia', () => {
    const r = calcPrecioUnidadConMinimo({ unit, kmTotal: 400, movPorDia: [], movKmPorDia: [], dolar: 1, dias: 2 });
    expect(r.esValorBase).toBe(false);
  });
  test('con umbral 500 el mismo viaje paga valor base', () => {
    const r = calcPrecioUnidadConMinimo({ unit, kmTotal: 400, movPorDia: [], movKmPorDia: [], dolar: 1, dias: 2, params: { ...PARAMETROS_DEFAULT, kmBaseThreshold: 500 } });
    expect(r.esValorBase).toBe(true);
    cerca(r.baseNeto, 1000);
  });
});

describe('parámetros generales', () => {
  test('acepta números guardados como texto', () => {
    expect(normalizarParametros({ iva: '0.21' }).iva).toBe(0.21);
    expect(normalizarParametros({ iva: '0,105' }).iva).toBe(0.105);
  });
  test('valores inválidos o faltantes → por defecto', () => {
    expect(normalizarParametros(null)).toEqual(PARAMETROS_DEFAULT);
    expect(normalizarParametros({ senaPorc: 0, iva: 5, kmBaseThreshold: -1 })).toEqual(PARAMETROS_DEFAULT);
  });
  test('IVA 0 es válido', () => {
    expect(normalizarParametros({ iva: 0 }).iva).toBe(0);
  });
  test('seña según método de pago', () => {
    const p = { ...PARAMETROS_DEFAULT, senaPorc: 0.4, senaOnlinePorc: 0.15 };
    expect(porcentajeSena('transferencia', p)).toBe(0.4);
    expect(porcentajeSena('efectivo', p)).toBe(0.4);
    expect(porcentajeSena('mercadopago', p)).toBe(0.15);
    expect(porcentajeSena('tarjeta', p)).toBe(0.15);
    expect(metodosPago(p).map(m => m.porc)).toEqual([0.4, 0.4, 0.15, 0.15]);
    expect(metodosPago(p)[0].desc).toBe('Transferís el 40% para confirmar');
  });
  test('formato de porcentaje', () => {
    expect(fmtPorc(0.21)).toBe('21%');
    expect(fmtPorc(0.105)).toBe('10,5%');
  });
});
