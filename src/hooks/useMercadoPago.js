// Pagos online con MercadoPago.
// La preferencia se crea en el backend (api/crear-preferencia, Vercel Serverless Function).
import { crearReserva } from '../firebase/services';

export async function crearPreferenciaMercadoPago({ monto, titulo, descripcion, totalViaje, referencia }) {
  const response = await fetch('/api/crear-preferencia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monto, titulo, descripcion, totalViaje, referencia }),
  });
  if (!response.ok) throw new Error('Error al crear preferencia');
  const data = await response.json();
  if (!data?.init_point) throw new Error('MercadoPago no devolvió el link de pago');
  return data;
}

// Guarda la reserva ANTES de salir a MercadoPago (si se guarda después, la
// redirección puede cortar la escritura y la cotización se pierde).
// `datos` es el documento de la reserva (con nroCotizacion, cliente, totales...).
export async function iniciarPagoOnline({ datos, monto, titulo, descripcion }) {
  const pref = await crearPreferenciaMercadoPago({
    monto,
    titulo,
    descripcion,
    totalViaje: datos.grandTotal,
    referencia: datos.nroCotizacion,
  });
  await crearReserva({ ...datos, mpPreferenceId: pref.id });
  window.location.href = pref.init_point;
  return pref;
}
