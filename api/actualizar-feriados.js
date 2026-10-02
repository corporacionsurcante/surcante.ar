// Vercel Serverless Function — actualiza el calendario de feriados de Argentina
// en Firestore (config/feriadosAR), que usa la tarifa dinámica del cotizador.
//
//  - Vercel Cron la ejecuta el día 1 de cada mes (ver vercel.json).
//  - El admin también puede dispararla desde Admin → Tarifa dinámica → "Actualizar ahora".
//
// Nunca borra datos: si la fuente falla o devuelve algo incompleto, se conserva el
// calendario que ya estaba guardado.
//
// Variables de entorno:
//   FIREBASE_SERVICE_ACCOUNT  (ya existe, la usa api/notificar.js)
//   CRON_SECRET               texto largo al azar: Vercel lo manda en el cron como "Bearer <CRON_SECRET>"
//   FERIADOS_API_URL          (opcional) otra fuente; usar {year} donde va el año.
//                             Formato esperado: [{ fecha: 'YYYY-MM-DD', nombre, tipo }]
import admin from 'firebase-admin';

const FUENTE_DEFAULT = 'https://api.argentinadatos.com/v1/feriados/{year}';

// Días no laborables con fines turísticos (puentes) fijados por el Gobierno.
// Fuente: Jefatura de Gabinete, Resolución 164/2025 (Boletín Oficial) — Ley 27.399.
// Se agregan siempre, aunque la fuente automática no los incluya.
// Cuando el Gobierno publique los de 2027, sumarlos acá o cargarlos en el panel
// (Tarifa dinámica → Otras fechas de alta demanda).
const PUENTES_OFICIALES = [
  { fecha: '2026-03-23', nombre: 'Día no laborable con fines turísticos', tipo: 'puente' },
  { fecha: '2026-07-10', nombre: 'Día no laborable con fines turísticos', tipo: 'puente' },
  { fecha: '2026-12-07', nombre: 'Día no laborable con fines turísticos', tipo: 'puente' },
];

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta env var FIREBASE_SERVICE_ACCOUNT');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

// Devuelve 'cron', 'admin' o null
async function quienLlama(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return 'cron';
  try {
    const dec = await admin.auth().verifyIdToken(token);
    if (!dec.email) return null;
    const snap = await admin.firestore().doc(`admins/${dec.email}`).get();
    return snap.exists ? 'admin' : null;
  } catch (_) {
    return null;
  }
}

async function traerAnio(plantilla, year) {
  const resp = await fetch(plantilla.replace('{year}', String(year)), { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const lista = Array.isArray(data) ? data : (data.feriados || data.data || []);
  return lista
    .filter(f => f && /^\d{4}-\d{2}-\d{2}$/.test(String(f.fecha || '').slice(0, 10)))
    .map(f => ({
      fecha: String(f.fecha).slice(0, 10),
      nombre: String(f.nombre || f.motivo || 'Feriado').slice(0, 120),
      tipo: String(f.tipo || 'feriado').slice(0, 40),
    }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }
  try {
    initAdmin();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }

  const quien = await quienLlama(req);
  if (!quien) return res.status(401).json({ ok: false, error: 'No autorizado' });

  try {
    const plantilla = process.env.FERIADOS_API_URL || FUENTE_DEFAULT;
    const ref = admin.firestore().doc('config/feriadosAR');
    const previos = (await ref.get()).data()?.feriados || [];

    const anioActual = new Date(Date.now() - 3 * 3600000).getUTCFullYear(); // año en Argentina
    const nuevos = {};
    const detalle = {};

    for (const y of [anioActual, anioActual + 1]) {
      try {
        const lista = await traerAnio(plantilla, y);
        // Un año completo trae al menos 8 fechas; si trae menos, se conserva lo anterior
        if (lista.length >= 8) { nuevos[y] = lista; detalle[y] = `actualizado (${lista.length} fechas)`; }
        else detalle[y] = `sin cambios (la fuente devolvió ${lista.length})`;
      } catch (e) {
        detalle[y] = `sin cambios (${e.message})`;
      }
    }

    const hayNuevos = Object.keys(nuevos).length > 0;
    if (!hayNuevos) {
      await ref.set({ ultimoIntento: new Date().toISOString(), detalle }, { merge: true });
      return res.status(200).json({ ok: true, guardado: false, detalle });
    }

    // Se reemplazan solo los años que llegaron bien; los demás se conservan
    const conservados = previos.filter(f => !nuevos[String(f.fecha).slice(0, 4)]);
    const porFecha = new Map();
    [...conservados, ...Object.values(nuevos).flat()].forEach(f => porFecha.set(f.fecha, f));
    // Los puentes oficiales siempre quedan (sin pisar lo que la fuente ya trajo)
    PUENTES_OFICIALES.forEach(p => { if (!porFecha.has(p.fecha)) porFecha.set(p.fecha, p); });

    const feriados = Array.from(porFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    await ref.set({
      feriados,
      fuente: plantilla.replace('{year}', '<año>'),
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: quien === 'cron' ? 'tarea mensual' : 'admin',
      detalle,
    }, { merge: true });

    return res.status(200).json({ ok: true, guardado: true, detalle, total: feriados.length });
  } catch (e) {
    console.error('actualizar-feriados:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
