// Bases operativas — se usan para cálculo de km. La dirección exacta no se muestra al cliente.
export const BASES = [
  {
    id: 'bsas',
    nombre: 'Buenos Aires',
    zona: 'CABA, GBA y provincia de Buenos Aires',
    direccion: 'Avenida General Paz 12235, Lomas del Mirador, Buenos Aires',
    coords: { lat: -34.6644, lng: -58.5224 },
  },
  {
    id: 'villa-regina',
    nombre: 'Villa Regina',
    zona: 'Alto Valle, Neuquén, Río Negro y zonas aledañas',
    direccion: 'Avenida Rivadavia 192, Villa Regina, Río Negro',
    coords: { lat: -39.1002, lng: -67.0785 },
  },
];

// Compatibilidad — base por defecto (Buenos Aires)
export const BASE_ADDRESS = BASES[0].direccion;
export const BASE_COORDS = BASES[0].coords;

// Distancia en línea recta (Haversine, en km) — para elegir la base más cercana
export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Devuelve la base más cercana a un punto {lat, lng}
export function baseMasCercana(punto) {
  return BASES.reduce((mejor, base) =>
    distanciaKm(punto, base.coords) < distanciaKm(punto, mejor.coords) ? base : mejor
  , BASES[0]);
}

export const IVA = 0.21;
export const SENA_PORCENTAJE = 0.30;
export const KM_MOV_INCLUIDOS = 150; // km incluidos por movimiento en destino
// Precios de unidades — se cargan desde Firebase (config/precios)
