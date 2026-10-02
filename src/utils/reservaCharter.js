// Arma el documento que se guarda en Firestore (colección `reservas`) para una
// cotización charter. Lo usan la pantalla de confirmación y el pago online, así el
// PDF, el panel admin y MercadoPago ven exactamente los mismos datos.
export function armarReservaCharter(reserva, pago, nroCotizacion) {
  const {
    origen, destino, fechaInicio, fechaFin, dias, flotaUnidades = [], kmTotal, puntosCarga,
    mismodia, horaInicio, horaFin,
  } = reserva;
  return {
    tipo: 'charter',
    nroCotizacion,
    baseId: reserva.baseId || '',
    baseNombre: reserva.baseNombre || '',
    origen: origen || '',
    destino: destino || '',
    fechaInicio: fechaInicio || '',
    fechaFin: fechaFin || '',
    mismodia: !!mismodia,
    horaInicio: mismodia ? (horaInicio || '') : '',
    horaFin: mismodia ? (horaFin || '') : '',
    dias: dias || 1,
    kmTotal: kmTotal || 0,
    puntosCarga: puntosCarga || [],
    clienteNombre: pago.clienteNombre || '',
    clienteWhatsapp: pago.clienteWhatsapp || '',
    flotaUnidades: flotaUnidades.map(u => ({ id: u.id, label: u.label, tipo: u.tid, unidadId: u.unidadId || u.tid })),
    grandTotal: pago.grandTotal,
    sena: pago.sena,
    saldo: pago.saldo,
    payMethod: pago.payMethod,
    porcentaje: pago.porcentaje,
    tarifaDinamica: pago.tarifaDinamica || null,
  };
}
