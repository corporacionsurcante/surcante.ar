// Vercel Serverless Function — valida un token de acceso personal de Egresados
// y emite un custom token de Firebase con los claims {rol, opId, refId, busId?}.
//
// El cliente llama POST /api/acceso { token } y recibe { customToken, rol, opId, refId, busId, nombre }.
// Con ese customToken hace signInWithCustomToken(auth, token) y puede leer Firestore
// según las reglas que verifican los claims.
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    return res.status(200).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let token;
  if (req.method === 'GET') {
    token = req.query.token;
  } else {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    token = body.token;
  }

  if (!token || typeof token !== 'string' || token.length < 10 || token.length > 64) {
    return res.status(400).json({ error: 'Token inválido' });
  }

  try {
    initAdmin();
    const db = admin.firestore();
    const snap = await db.collection('accesos').doc(token).get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'Link no encontrado. Pedile uno nuevo a tu agencia.' });
    }

    const acceso = snap.data();

    if (!acceso.activo) {
      return res.status(403).json({ error: 'Este link fue revocado. Pedile uno nuevo a tu agencia.' });
    }

    const { opId, rol, refId, nombre = '' } = acceso;

    if (!opId || !rol || !refId) {
      return res.status(400).json({ error: 'Datos de acceso incompletos.' });
    }

    // Para conductores y coordinadores buscamos su bus asignado
    let busId = null;
    if (rol === 'conductor' || rol === 'coordinador') {
      try {
        const staffSnap = await db.doc(`operativos/${opId}/staff/${refId}`).get();
        if (staffSnap.exists) busId = staffSnap.data().busId || null;
      } catch (_) { /* sin staff asignado */ }
    }
    // Para pasajeros también obtenemos su bus
    if (rol === 'pasajero') {
      try {
        const paxSnap = await db.doc(`operativos/${opId}/pasajeros/${refId}`).get();
        if (paxSnap.exists) busId = paxSnap.data().busId || null;
      } catch (_) { /* sin bus asignado */ }
    }

    // Claims del custom token (sin campo email para que isAdmin() devuelva false)
    const claims = { rol, opId, refId };
    if (nombre) claims.nombre = nombre;
    if (busId) claims.busId = busId;

    const uid = `portal_${token}`;
    const customToken = await admin.auth().createCustomToken(uid, claims);

    // Actualizar último acceso (no bloquea la respuesta)
    snap.ref.update({ ultimoAcceso: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

    return res.status(200).json({ customToken, rol, opId, refId, busId, nombre });
  } catch (err) {
    console.error('[api/acceso]', err.message);
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
}
