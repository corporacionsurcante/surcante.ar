export const DATOS_BANCARIOS = {
  banco: 'Banco Macro',
  sucursal: 'Suc. 544',
  tipoCuenta: 'Cuenta Corriente $',
  numeroCuenta: '3-5440941641566-6',
  cbu: '2850544230094164156661',
  alias: '', // agregar alias si tienen
  titular: 'SURCANTE S.R.L',
  cuit: '30-71098078-7',
};

export const WHATSAPP = [
  {
    nombre: 'José Bournissen',
    numero: '5491158100414',
    label: 'José',
  },
  {
    nombre: 'Sebastián Machado',
    numero: '5492984524724',
    label: 'Sebastián',
  },
];

export const PORCENTAJES_PAGO = {
  mercadopago: 0.10,  // 10% con MP
  tarjeta: 0.10,      // 10% con tarjeta
  transferencia: 0.30, // 30% transferencia
  efectivo: 0.30,     // 30% efectivo (va a WhatsApp)
};

export const METODOS_PAGO = [
  {
    id: 'mercadopago',
    label: 'MercadoPago',
    icon: '💳',
    descripcion: 'Pagás el 10% ahora online',
    porcentaje: 0.10,
    online: true,
  },
  {
    id: 'tarjeta',
    label: 'Tarjeta',
    icon: '🏦',
    descripcion: 'Pagás el 10% ahora online',
    porcentaje: 0.10,
    online: true,
  },
  {
    id: 'transferencia',
    label: 'Transferencia',
    icon: '🏛️',
    descripcion: 'Transferís el 30% para confirmar',
    porcentaje: 0.30,
    online: false,
  },
  {
    id: 'efectivo',
    label: 'Efectivo',
    icon: '💵',
    descripcion: 'Coordinás por WhatsApp',
    porcentaje: 0.30,
    online: false,
  },
];
