// Hook para crear preferencia de pago en MercadoPago
// La preferencia se crea desde el backend (Vercel Serverless Function)

export async function crearPreferenciaMercadoPago({ grandTotal, montoAhora, origen, destino, fechaInicio, fechaFin, flotaUnidades }) {
  const response = await fetch('/api/crear-preferencia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      monto: montoAhora,
      titulo: `Surcante · ${origen} → ${destino}`,
      descripcion: `${fechaInicio} al ${fechaFin} · ${flotaUnidades.length} unidad${flotaUnidades.length !== 1 ? 'es' : ''}`,
      totalViaje: grandTotal,
    }),
  });
  if (!response.ok) throw new Error('Error al crear preferencia');
  return response.json();
}
