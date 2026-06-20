// Precios receptivo en USD — se convierten a pesos con dólar BNA al momento de cotizar

export const CITY_TOUR_USD = {
  'MIX 60':     682.38,  // doble piso y omnibus 60 — mismo precio
  'Comun 45':   580.03,
  'Minibus 24': 409.43,
  'Minibus 19': 409.43,
};

export const CIRCUITOS = [
  {
    id: 'temaiken',
    nombre: 'Temaikén',
    emoji: '🦁',
    descripcion: 'Bioparque Temaikén · Escobar',
    precioUSD: {
      'MIX 60':     1023.58,
      'Comun 45':   852.98,
      'Minibus 24': 682.38,
      'Minibus 19': 682.38,
    },
  },
  {
    id: 'parque-costa',
    nombre: 'Parque de la Costa',
    emoji: '🎢',
    descripcion: 'Parque de la Costa · Tigre',
    precioUSD: {
      'MIX 60':     1023.58,
      'Comun 45':   852.98,
      'Minibus 24': 682.38,
      'Minibus 19': 682.38,
    },
  },
  {
    id: 'la-plata',
    nombre: 'La Plata',
    emoji: '🏛️',
    descripcion: 'Ciudad de La Plata · Museo y Catedral',
    precioUSD: {
      'MIX 60':     1023.58,
      'Comun 45':   852.98,
      'Minibus 24': 682.38,
      'Minibus 19': 682.38,
    },
  },
  {
    id: 'tigre',
    nombre: 'Delta del Tigre',
    emoji: '🚤',
    descripcion: 'Delta del Tigre · Puerto de Frutos',
    precioUSD: {
      'MIX 60':     1023.58,
      'Comun 45':   852.98,
      'Minibus 24': 682.38,
      'Minibus 19': 682.38,
    },
  },
  {
    id: 'lujan',
    nombre: 'Luján',
    emoji: '⛪',
    descripcion: 'Basílica de Luján',
    precioUSD: {
      'MIX 60':     1023.58,
      'Comun 45':   852.98,
      'Minibus 24': 682.38,
      'Minibus 19': 682.38,
    },
  },
];

export const TRANSFERS_AEROPUERTO = [
  {
    id: 'ezeiza-in',
    nombre: 'Ezeiza · Llegada',
    emoji: '✈️',
    descripcion: 'Aeropuerto Ezeiza → Hotel',
    precioUSD: 1000,
  },
  {
    id: 'ezeiza-out',
    nombre: 'Ezeiza · Salida',
    emoji: '✈️',
    descripcion: 'Hotel → Aeropuerto Ezeiza',
    precioUSD: 1000,
  },
  {
    id: 'ezeiza-inout',
    nombre: 'Ezeiza · In + Out',
    emoji: '✈️',
    descripcion: 'Llegada y salida Ezeiza (mismo día)',
    precioUSD: 1800,
  },
  {
    id: 'aeroparque-in',
    nombre: 'Aeroparque · Llegada',
    emoji: '🛫',
    descripcion: 'Aeroparque Jorge Newbery → Hotel',
    precioUSD: 800,
  },
  {
    id: 'aeroparque-out',
    nombre: 'Aeroparque · Salida',
    emoji: '🛫',
    descripcion: 'Hotel → Aeroparque Jorge Newbery',
    precioUSD: 800,
  },
  {
    id: 'aeroparque-inout',
    nombre: 'Aeroparque · In + Out',
    emoji: '🛫',
    descripcion: 'Llegada y salida Aeroparque (mismo día)',
    precioUSD: 1400,
  },
];
