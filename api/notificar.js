// Vercel Serverless Function — aviso de cotización nueva al panel admin.
//
// El cotizador llama a este endpoint con { reservaId } justo después de guardar la
// reserva. El servidor (firebase-admin, saltea las reglas de Firestore):
//   1. verifica que la reserva exista, sea reciente y no haya sido avisada antes,
//   2. crea el documento en `notificaciones` (el contador rojo del panel),
//   3. envía push FCM a todos los dispositivos admin registrados en `fcm_tokens`.
// Así el endpoint no se puede usar para mandar mensajes arbitrarios.
//
// Requiere la env var FIREBASE_SERVICE_ACCOUNT (JSON completo del service account)
// en Vercel para Production y Preview (ver INSTRUCCIONES.md).
import admin from 'firebase-admin';

const MAX_ANTIGUEDAD_MS = 30 * 60 * 1000; // solo reservas creadas hace menos de 30 min

const TIPO_LABEL = {
  charter: 'Charter',
  receptivo: 'Receptivo',
  disposicion: 'A disposición',
  'movimientos-caba-gba': 'Movimientos CABA/GBA',
};

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta env var FIREBASE_SERVICE_ACCOUNT');
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

function formatARS(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
}

function leerBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { reservaId } = leerBody(req);
  if (!reservaId || typeof reservaId !== 'string' || reservaId.length > 64 || reservaId.includes('/')) {
    return res.status(400).json({ error: 'reservaId inválido' });
  }

  try {
    initAdmin();
  } catch (e) {
    console.error('FCM no configurado:', e.message);
    return res.status(200).json({ ok: false, motivo: 'FIREBASE_SERVICE_ACCOUNT no configurada' });
  }

  const db = admin.firestore();
  const reservaRef = db.collection('reservas').doc(reservaId);

  // 1. Validar y marcar como avisada (transacción: un solo aviso por reserva)
  let r;
  try {
    r = await db.runTransaction(async (tx) => {
      const snap = await tx.get(reservaRef);
      if (!snap.exists) return { error: 404 };
      const data = snap.data();
      if (data.notificado) return { repetido: true };
      const creado = data.creadoEn?.toMillis ? data.creadoEn.toMillis() : 0;
      if (!creado || Date.now() - creado > MAX_ANTIGUEDAD_MS) return { error: 410 };
      tx.update(reservaRef, { notificado: true });
      return { data };
    });
  } catch (e) {
    console.error('Error validando reserva:', e);
    return res.status(500).json({ error: 'Error validando la reserva' });
  }
  if (r.error === 404) return res.status(404).json({ error: 'Reserva inexistente' });
  if (r.error === 410) return res.status(410).json({ error: 'Reserva vencida para aviso' });
  if (r.repetido) return res.status(200).json({ ok: true, repetido: true });

  const d = r.data;
  const tipo = d.tipo || 'charter';
  const cliente = String(d.clienteNombre || 'Cliente sin nombre').slice(0, 80);
  const ruta = d.origen && d.destino ? `${d.origen} → ${d.destino}` : (d.unidad || d.descripcion || '');

  // 2. Notificación del panel (contador de "Reservas")
  try {
    await db.collection('notificaciones').add({
      tipo: 'cotizacion_finalizada',
      leida: false,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      reservaId,
      nroCotizacion: d.nroCotizacion || '',
      servicio: tipo,
      clienteNombre: d.clienteNombre || '',
      clienteWhatsapp: d.clienteWhatsapp || '',
      origen: d.origen || '',
      destino: d.destino || '',
      grandTotal: Number(d.grandTotal) || 0,
      payMethod: d.payMethod || '',
      mensaje: `Nueva cotización ${TIPO_LABEL[tipo] || tipo} · ${cliente}`,
    });
  } catch (e) {
    console.error('Error creando notificación:', e);
  }

  // 3. Push a los dispositivos admin
  const title = `🚌 Nueva cotización · ${TIPO_LABEL[tipo] || tipo}`.slice(0, 120);
  const body = `${cliente} · ${formatARS(d.grandTotal)}${ruta ? ` · ${ruta}` : ''}`.slice(0, 300);
  try {
    const snap = await db.collection('fcm_tokens').get();
    const tokens = snap.docs.map(t => t.id).filter(Boolean);
    if (tokens.length === 0) {
      return res.status(200).json({ ok: true, enviados: 0, motivo: 'Sin dispositivos registrados' });
    }

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      data: { title, body, url: '/admin' },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
      apns: { headers: { 'apns-priority': '10' } },
    });

    // Limpiar tokens inválidos (dispositivos que desinstalaron / expiraron)
    const invalidos = [];
    result.responses.forEach((resp, i) => {
      const code = resp.error?.code || '';
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
