// DELETE /api/agencia-coordinadores { email }
// Elimina un coordinador de la agencia del usuario autenticado.
// Requiere: Authorization: Bearer <Firebase ID Token> con claims { rol:'agencia', agenciaId }
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const CORS_RE = /^https?:\/\/(localhost|([\w-]+\.)?surcante\.(com|ar))(:\d+)?$/;

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = CORS_RE.test(origin) ? origin : 'https://surcante.com';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método no permitido' });

  // Verificar Bearer token
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sin autorización' });
  }
  const idToken = authHeader.slice(7);

  // Leer body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (_) {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const { email } = body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email requerido' });
  }
  const emailLower = email.trim().toLowerCase();

  try {
    initAdmin();
    const db = admin.firestore();

    // Verificar token y claims de agencia
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.rol !== 'agencia' || !decoded.agenciaId) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    const { agenciaId } = decoded;

    // Verificar que el coordinador pertenece a esta agencia
    const userRef = db.collection('agencia_users').doc(emailLower);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'Coordinador no encontrado' });
    }
    if (userSnap.data().agenciaId !== agenciaId) {
      return res.status(403).json({ error: 'No pertenece a tu agencia' });
    }

    await userRef.delete();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/agencia-coordinadores]', err.message);
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
}
