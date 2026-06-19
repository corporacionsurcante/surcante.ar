// Base oculta — solo para cálculo de km, nunca se muestra al cliente
export const BASE_ADDRESS = 'Avenida General Paz 12235, Lomas del Mirador, Buenos Aires';
export const BASE_COORDS = { lat: -34.6644, lng: -58.5224 };

export const IVA = 0.21;
export const SENA_PORCENTAJE = 0.30;
export const KM_MOV_INCLUIDOS = 50;

export const UNIT_TYPES = {
  u1: {
    id: 'u1',
    name: 'Omnibus Premium',
    seats: 60,
    features: 'A/C · baño · wi-fi',
    icon: '🚌',
    usdKm: 2.50,
    movDesc: 0,
    movUSD: [110, 170, 250],
    color: '#6B21D6',
  },
  u2: {
    id: 'u2',
    name: 'Omnibus Estándar',
    seats: 45,
    features: 'A/C · baño',
    icon: '🚌',
    usdKm: 2.00,
    movDesc: 0.20,
    movUSD: [110, 170, 250],
    color: '#4A0FA8',
  },
  u3: {
    id: 'u3',
    name: 'Minibus Ejecutivo',
    seats: 24,
    features: 'A/C',
    icon: '🚐',
    usdKm: 1.80,
    movDesc: 0.30,
    movUSD: [110, 170, 250],
    color: '#7C3AED',
  },
};

export const PAYMENT_METHODS = [
  { id: 'mercadopago', label: 'MercadoPago', icon: 'mp' },
  { id: 'tarjeta',     label: 'Tarjeta',      icon: 'card' },
  { id: 'transferencia', label: 'Transferencia', icon: 'bank' },
  { id: 'efectivo',    label: 'Efectivo',     icon: 'cash' },
];
