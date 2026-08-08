// Vercel Serverless Function — envía push FCM a todos los dispositivos admin registrados.
// Se dispara desde el cliente cuando se crea una cotización (ver src/firebase/services.js).
// Requiere env var FIREBASE_SERVICE_ACCOUNT (JSON completo del service account, ver INSTRUCCIONES.md).
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta env var FIREBASE_SERVICE_ACCOUNT');
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    initAdmin();
  } catch (e) {
    console.error('FCM no configurado:', e.message);
    return res.status(200).json({ ok: false, motivo: 'FCM no configurado' });
  }

  const { titulo, cuerpo } = req.body || {};
  const title = String(titulo || '🚌 Nueva cotización — Surcante').slice(0, 120);
  const body = String(cuerpo || 'Entró una nueva cotización. ¡No pierdas al cliente!').slice(0, 300);

  try {
    const db = admin.firestore();
    const snap = await db.collection('fcm_tokens').get();
    const tokens = snap.docs.map(d => d.id).filter(Boolean);
    if (tokens.length === 0) {
      return res.status(200).json({ ok: true, enviados: 0, motivo: 'Sin dispositivos registrados' });
    }

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      data: { title, body, url: '/admin' },
      webpush: {
        headers: { Urgency: 'high', TTL: '86400' },
      },
      apns: {
        headers: { 'apns-priority': '10' },
      },
    });

    // Limpiar tokens inválidos (dispositivos que desinstalaron / expiraron)
    const invalidos = [];
    result.responses.forEach((r, i) => {
      const code = r.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        invalidos.push(tokens[i]);
      }
    });
    await Promise.all(invalidos.map(t => db.collection('fcm_tokens').doc(t).delete()));

    return res.status(200).json({ ok: true, enviados: result.successCount, fallidos: result.failureCount });
  } catch (e) {
    console.error('Error enviando push:', e);
    return res.status(500).json({ error: 'Error enviando notificaciones' });
  }
}
