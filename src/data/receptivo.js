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

// ---- DISPONIBILIDAD POR HORAS ----
// Paquetes base
export const DISPONIBILIDAD_PAQUETES = [
  { id: 'disp-6h',  horas: 6,  label: '6 horas',  precioUSD: 400,  descripcion: 'Hasta 6 horas de servicio' },
  { id: 'disp-12h', horas: 12, label: '12 horas', precioUSD: 1200, descripcion: 'Hasta 12 horas de servicio' },
  { id: 'disp-24h', horas: 24, label: '24 horas', precioUSD: 1800, descripcion: 'Hasta 24 horas de servicio' },
];

// Precio por hora extra (fracción entre paquetes)
export const DISPONIBILIDAD_HORA_EXTRA_USD = 150; // por hora entre 6-12hs y 12-15hs

// Lógica de cálculo:
// 1-3 horas → sin paquete, se cobra por hora ($150 c/u)
// 4-6 horas → paquete 6hs ($400)  [desde hora 4 conviene paquete]
// 7-12 horas → paquete 12hs ($1200) [se cobran horas a $150 entre 6 y 12]
// 13-15 horas → paquete 12hs + horas extra
// 16-24 horas → paquete 24hs ($1800)

export function calcPrecioDisponibilidad(horas) {
  if (horas <= 0) return { precioUSD: 0, descripcion: '', paquete: null };
  if (horas <= 3) {
    // Por hora a $150
    return { precioUSD: horas * DISPONIBILIDAD_HORA_EXTRA_USD, descripcion: `${horas} hora${horas > 1 ? 's' : ''} × USD ${DISPONIBILIDAD_HORA_EXTRA_USD}`, paquete: null };
  }
  if (horas <= 6) {
    // Paquete 6hs
    return { precioUSD: 400, descripcion: 'Paquete 6 horas', paquete: DISPONIBILIDAD_PAQUETES[0] };
  }
  if (horas <= 12) {
    // Paquete 12hs
    return { precioUSD: 1200, descripcion: 'Paquete 12 horas', paquete: DISPONIBILIDAD_PAQUETES[1] };
  }
  if (horas <= 15) {
    // Paquete 12hs + horas extra
    const extra = horas - 12;
    return { precioUSD: 1200 + extra * DISPONIBILIDAD_HORA_EXTRA_USD, descripcion: `Paquete 12hs + ${extra}h extra × USD ${DISPONIBILIDAD_HORA_EXTRA_USD}`, paquete: DISPONIBILIDAD_PAQUETES[1] };
  }
  // Paquete 24hs
  return { precioUSD: 1800, descripcion: 'Paquete 24 horas', paquete: DISPONIBILIDAD_PAQUETES[2] };
}
