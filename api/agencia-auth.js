// Verifica un Google ID token y emite un custom token de Firebase para agencias.
// POST /api/agencia-auth { idToken } → { customToken, agenciaId, nombre }
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = /^https?:\/\/(localhost|surcante\.com)(:\d+)?$/.test(origin)
    ? origin : 'https://surcante.com';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { idToken } = body;

  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'ID token requerido' });
  }

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email;
    if (!email) return res.status(400).json({ error: 'Token sin email' });

    const db = admin.firestore();
    const snap = await db.collection('agencia_users').doc(email.toLowerCase()).get();

    if (!snap.exists) {
      return res.status(403).json({ error: 'Tu cuenta no está habilitada. Contactá a tu agencia.' });
    }

    const userData = snap.data();
    if (!userData.activa) {
      return res.status(403).json({ error: 'Tu acceso está desactivado. Contactá a tu agencia.' });
    }

    const { agenciaId, nombre = '' } = userData;
    if (!agenciaId) return res.status(400).json({ error: 'Configuración incorrecta.' });

    const claims = { rol: 'agencia', agenciaId };
    if (nombre) claims.nombre = nombre;

    const uid = `agencia_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const customToken = await admin.auth().createCustomToken(uid, claims);

    snap.ref.update({ ultimoAcceso: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

    return res.status(200).json({ customToken, agenciaId, nombre });
  } catch (err) {
    console.error('[api/agencia-auth]', err.message);
    if (err.code === 'auth/argument-error' || err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Sesión expirada. Volvé a ingresar con Google.' });
    }
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
}
