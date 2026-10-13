// POST /api/admin-cleanup { accion, confirmar? }
// Herramienta de mantenimiento para el admin. Limpia datos obsoletos/huérfanos.
// Requiere: Authorization: Bearer <Firebase ID Token> de un admin (email en /admins).
//
// Acciones:
//   preview         → lista agencia_users huérfanos, codigos usados/inactivos, operativos
//   limpiar_todo    → borra agencia_users huérfanos + codigos usados/inactivos (confirmar: true)
//   reset_egresados → borra TODOS los operativos, agencias, agencia_users, agencia_codigos (confirmar: true)
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const CORS_RE = /^https?:\/\/(localhost|([\w-]+\.)?surcante\.(com|ar))(:\d+)?$/;

async function deleteInBatches(refs) {
  const BATCH_SIZE = 400;
  let deleted = 0;
  const db = admin.firestore();
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_SIZE).forEach(ref => batch.delete(ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, refs.length - i);
  }
  return deleted;
}

async function deleteSubcollections(opRef) {
  const db = admin.firestore();
  const subs = ['buses', 'staff', 'itinerario', 'avisos', 'pasajeros', 'ubicaciones', 'checkins', 'reportes'];
  for (const sub of subs) {
    const snap = await opRef.collection(sub).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = CORS_RE.test(origin) ? origin : 'https://surcante.com';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Sin autorización' });
  const idToken = authHeader.slice(7);

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (_) {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const { accion, confirmar } = body;
  if (!accion) return res.status(400).json({ error: 'accion requerida' });

  try {
    initAdmin();
    const db = admin.firestore();

    // Verificar que es admin (email en /admins)
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.email) return res.status(403).json({ error: 'Sin permiso' });
    const adminSnap = await db.doc(`admins/${decoded.email}`).get();
    if (!adminSnap.exists) return res.status(403).json({ error: 'Sin permiso' });

    // --- PREVIEW ---
    if (accion === 'preview') {
      const [agenciasSnap, usersSnap, codigosSnap, opSnap] = await Promise.all([
        db.collection('agencias').get(),
        db.collection('agencia_users').get(),
        db.collection('agencia_codigos').get(),
        db.collection('operativos').get(),
      ]);

      const agenciasIds = new Set(agenciasSnap.docs.map(d => d.id));

      const huerfanos = usersSnap.docs
        .filter(d => !d.data().agenciaId || !agenciasIds.has(d.data().agenciaId))
        .map(d => ({ id: d.id, agenciaId: d.data().agenciaId || '—', nombre: d.data().nombre || '' }));

      const codigosObsoletos = codigosSnap.docs
        .filter(d => d.data().usado || d.data().activo === false)
        .map(d => ({ id: d.id, agenciaId: d.data().agenciaId || '—', usado: !!d.data().usado, activo: d.data().activo !== false }));

      const operativos = opSnap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre || d.id,
        agenciaId: d.data().agenciaId || '—',
        estado: d.data().estado || '—',
      }));

      return res.status(200).json({
        agencias: agenciasSnap.size,
        huerfanos,
        codigosObsoletos,
        operativos,
      });
    }

    // --- LIMPIAR TODO (huérfanos + códigos usados) ---
    if (accion === 'limpiar_todo') {
      if (!confirmar) return res.status(400).json({ error: 'Requerís confirmar: true' });

      const [agenciasSnap, usersSnap, codigosSnap] = await Promise.all([
        db.collection('agencias').get(),
        db.collection('agencia_users').get(),
        db.collection('agencia_codigos').get(),
      ]);

      const agenciasIds = new Set(agenciasSnap.docs.map(d => d.id));

      const huerfanosRefs = usersSnap.docs
        .filter(d => !d.data().agenciaId || !agenciasIds.has(d.data().agenciaId))
        .map(d => d.ref);

      const codigosRefs = codigosSnap.docs
        .filter(d => d.data().usado || d.data().activo === false)
        .map(d => d.ref);

      const [deletedUsers, deletedCodigos] = await Promise.all([
        deleteInBatches(huerfanosRefs),
        deleteInBatches(codigosRefs),
      ]);

      return res.status(200).json({
        ok: true,
        deletedUsers,
        deletedCodigos,
        message: `Eliminados ${deletedUsers} usuario(s) huérfano(s) y ${deletedCodigos} código(s) obsoleto(s).`,
      });
    }

    // --- RESET COMPLETO (BORRA TODO el módulo egresados) ---
    if (accion === 'reset_egresados') {
      if (!confirmar) return res.status(400).json({ error: 'Requerís confirmar: true' });

      const [agenciasSnap, usersSnap, codigosSnap, opSnap] = await Promise.all([
        db.collection('agencias').get(),
        db.collection('agencia_users').get(),
        db.collection('agencia_codigos').get(),
        db.collection('operativos').get(),
      ]);

      // Borrar subcolecciones de operativos primero
      for (const opDoc of opSnap.docs) {
        await deleteSubcollections(opDoc.ref);
      }

      const [d1, d2, d3, d4] = await Promise.all([
        deleteInBatches(opSnap.docs.map(d => d.ref)),
        deleteInBatches(agenciasSnap.docs.map(d => d.ref)),
        deleteInBatches(usersSnap.docs.map(d => d.ref)),
        deleteInBatches(codigosSnap.docs.map(d => d.ref)),
      ]);

      return res.status(200).json({
        ok: true,
        deletedOperativos: d1,
        deletedAgencias: d2,
        deletedUsers: d3,
        deletedCodigos: d4,
        message: `Reset completo: ${d2} agencia(s), ${d1} operativo(s), ${d3} usuario(s), ${d4} código(s) eliminados.`,
      });
    }

    return res.status(400).json({ error: `Acción desconocida: ${accion}` });
  } catch (err) {
    console.error('[api/admin-cleanup]', err.message);
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
}
