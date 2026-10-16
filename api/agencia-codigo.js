// Valida un código de acceso de agencia (un solo uso) y emite un custom token.
// POST /api/agencia-codigo { codigo, dispositivoId } → { customToken, agenciaId, agenciaNombre }
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = /^https?:\/\/(localhost|([\w-]+\.)?surcante\.(com|ar))(:\d+)?$/.test(origin)
    ? origin : 'https://surcante.ar';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (_) {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const { codigo: codigoRaw, dispositivoId } = body;
  if (!codigoRaw || typeof codigoRaw !== 'string') {
    return res.status(400).json({ error: 'Código requerido' });
  }
  if (!dispositivoId || typeof dispositivoId !== 'string') {
    return res.status(400).json({ error: 'ID de dispositivo requerido' });
  }

  // Normalizar: mayúsculas, sin guiones ni espacios
  const codigo = codigoRaw.trim().toUpperCase().replace(/[-\s]/g, '');
  if (codigo.length !== 8) {
    return res.status(400).json({ error: 'Código inválido. Ingresá los 8 caracteres.' });
  }

  try {
    initAdmin();
    const db = admin.firestore();

    const codigoRef = db.collection('agencia_codigos').doc(codigo);
    const codigoSnap = await codigoRef.get();

    if (!codigoSnap.exists) {
      return res.status(404).json({ error: 'Código incorrecto o expirado.' });
    }

    const cd = codigoSnap.data();

    if (!cd.activo) {
      return res.status(403).json({ error: 'Este código fue desactivado.' });
    }
    if (cd.usado) {
      return res.status(403).json({ error: 'Este código ya fue utilizado.' });
    }
    if (cd.expira && new Date(cd.expira) < new Date()) {
      return res.status(403).json({ error: 'Este código expiró.' });
    }

    const { agenciaId } = cd;
    if (!agenciaId) {
      return res.status(500).json({ error: 'Código mal configurado.' });
    }

    let agenciaNombre = '';
    try {
      const agenciaSnap = await db.doc(`agencias/${agenciaId}`).get();
      if (agenciaSnap.exists) agenciaNombre = agenciaSnap.data().nombre || '';
    } catch (_) { /* continuar sin nombre */ }

    // UID vinculado al dispositivo + agencia para mantener sesión entre recargas
    const uid = `agencia_dev_${agenciaId}_${dispositivoId.replace(/[^a-z0-9_-]/gi, '').slice(0, 24)}`;
    const rolAgencia = cd.rolAgencia || 'gerente';
    const claims = { rol: 'agencia', agenciaId };
    if (agenciaNombre) claims.agenciaNombre = agenciaNombre;
    if (rolAgencia !== 'gerente') claims.rolAgencia = rolAgencia;

    const customToken = await admin.auth().createCustomToken(uid, claims);

    await codigoRef.update({
      usado: true,
      usadoEn: admin.firestore.FieldValue.serverTimestamp(),
      dispositivoId,
    });

    return res.status(200).json({ customToken, agenciaId, agenciaNombre, rolAgencia });
  } catch (err) {
    console.error('[api/agencia-codigo]', err.message);
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
}
