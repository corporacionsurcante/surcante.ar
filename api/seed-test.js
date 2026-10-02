// Endpoint temporal de datos de prueba — ELIMINAR DESPUÉS DE TESTEAR
// GET /api/seed-test?key=SEED_SURCANTE
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function genToken() {
  let t = '';
  for (let i = 0; i < 22; i++) t += ALFA[Math.floor(Math.random() * ALFA.length)];
  return t;
}

function diaISO(n = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.key !== 'SEED_SURCANTE') {
    return res.status(403).json({ error: 'Falta clave de acceso (?key=SEED_SURCANTE)' });
  }

  try {
    initAdmin();
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

    // ── Operativo ──────────────────────────────────────────────────────────
    const opRef = await db.collection('operativos').add({
      nombre: 'Viaje de Prueba — Colegio San Martín',
      destino: 'Bariloche',
      desde: diaISO(0),
      hasta: diaISO(3),
      estado: 'en_curso',
      creadoEn: now,
    });
    const opId = opRef.id;

    // ── Buses ──────────────────────────────────────────────────────────────
    const b1 = db.doc(`operativos/${opId}/buses/${db.collection('x').doc().id}`);
    const b2 = db.doc(`operativos/${opId}/buses/${db.collection('x').doc().id}`);
    const b1Id = b1.id; const b2Id = b2.id;

    // ── Staff ──────────────────────────────────────────────────────────────
    const c1 = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);
    const c2 = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);
    const co1 = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);
    const co2 = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);

    // ── Pasajeros ──────────────────────────────────────────────────────────
    const paxData = [
      { nombre: 'Juan',      apellido: 'Pérez',     dni: '12345678', codigoAgencia: 'TEST-001', busId: b1Id, hotel: 'Hotel Nevada',   habitacion: '101', asiento: '1A' },
      { nombre: 'Laura',     apellido: 'Gómez',     dni: '23456789', codigoAgencia: 'TEST-002', busId: b1Id, hotel: 'Hotel Nevada',   habitacion: '102', asiento: '2A' },
      { nombre: 'Diego',     apellido: 'Fernández', dni: '34567890', codigoAgencia: 'TEST-003', busId: b1Id, hotel: 'Hotel Nevada',   habitacion: '103', asiento: '3A' },
      { nombre: 'Sofía',     apellido: 'Martínez',  dni: '45678901', codigoAgencia: 'TEST-004', busId: b2Id, hotel: 'Hotel Bariloche',habitacion: '201', asiento: '1B' },
      { nombre: 'Lucas',     apellido: 'Torres',    dni: '56789012', codigoAgencia: 'TEST-005', busId: b2Id, hotel: 'Hotel Bariloche',habitacion: '202', asiento: '2B' },
      { nombre: 'Valentina', apellido: 'Sánchez',   dni: '67890123', codigoAgencia: 'TEST-006', busId: b2Id, hotel: 'Hotel Bariloche',habitacion: '203', asiento: '3B' },
    ];
    const paxRefs = paxData.map(() => db.doc(`operativos/${opId}/pasajeros/${db.collection('x').doc().id}`));

    // ── Commit en lotes ────────────────────────────────────────────────────
    const b = db.batch();

    b.set(b1, { codigo: 'Bus 1', nombre: 'Bus 1 — Violeta', color: 'violeta', capacidad: 50, interno: '301', creadoEn: now });
    b.set(b2, { codigo: 'Bus 2', nombre: 'Bus 2 — Azul',    color: 'azul',    capacidad: 50, interno: '302', creadoEn: now });

    b.set(c1,  { nombre: 'Carlos',    apellido: 'García',    telefono: '1112345678', rol: 'conductor',   busId: b1Id, creadoEn: now });
    b.set(c2,  { nombre: 'Pablo',     apellido: 'Rodríguez', telefono: '1123456789', rol: 'conductor',   busId: b2Id, creadoEn: now });
    b.set(co1, { nombre: 'María',     apellido: 'González',  telefono: '1198765432', rol: 'coordinador', busId: b1Id, creadoEn: now });
    b.set(co2, { nombre: 'Ana',       apellido: 'López',     telefono: '1187654321', rol: 'coordinador', busId: b2Id, creadoEn: now });

    paxData.forEach((p, i) => b.set(paxRefs[i], { ...p, creadoEn: now }));

    // Itinerario
    [
      {
        id: diaISO(0),
        actividades: [
          { hora: '07:00', titulo: 'Salida desde el colegio', nota: 'Punto de encuentro: portón principal. Documentos en mano.', notaConductor: 'Cargar nafta antes de salir — YPF autopista norte', notaCoord: 'Pasar lista completa antes de arrancar' },
          { hora: '14:00', titulo: 'Llegada a Bariloche', nota: 'Check-in en el hotel. Guardar valijas y salir a conocer.' },
          { hora: '16:30', titulo: 'Excursión Cerro Catedral', nota: 'Ski y snow en la nieve. Llevar ropa abrigada y protector solar.' },
          { hora: '20:30', titulo: 'Cena en el hotel', nota: 'Menú incluido. Reunión post-cena para repasar el día siguiente.' },
        ],
        notaGeneral: '🏔️ ¡Primer día! Recordar: documentos y pase de ski.',
      },
      {
        id: diaISO(1),
        actividades: [
          { hora: '08:00', titulo: 'Desayuno', nota: 'Bufet en el hotel' },
          { hora: '10:00', titulo: 'Circuito Chico', nota: 'Lago Nahuel Huapi, Cerro Campanario y Villa La Angostura.', notaConductor: 'Estacionar frente al mirador — 1h máx.' },
          { hora: '13:30', titulo: 'Almuerzo libre en el centro', nota: 'Reunirse en Plaza Perito Moreno a las 15:00.' },
          { hora: '15:00', titulo: 'Laguna de los Cántaros', nota: 'Caminata 2 hs — calzado cómodo obligatorio.' },
          { hora: '21:00', titulo: 'Cena y noche libre', nota: 'Retorno al hotel: máximo 00:30 hs.' },
        ],
      },
      {
        id: diaISO(2),
        actividades: [
          { hora: '08:00', titulo: 'Desayuno y check-out', nota: 'Dejar habitaciones antes de las 10:00.' },
          { hora: '10:30', titulo: 'Compras en el centro', nota: 'Chocolate artesanal, licores y souvenirs.' },
          { hora: '13:00', titulo: 'Almuerzo de despedida', nota: 'Restaurante El Patacón — asado patagónico incluido.', notaCoord: 'Contar que todos estén antes de salir' },
          { hora: '15:00', titulo: 'Regreso a Buenos Aires', nota: 'Arribo estimado: 03:00 hs del día siguiente.', notaConductor: 'Parada técnica en Junín de los Andes ~18:00 hs' },
        ],
        notaGeneral: '🎒 ¡Último día! Revisá que no olvides nada en la habitación.',
      },
    ].forEach(({ id, ...data }) => {
      b.set(db.doc(`operativos/${opId}/itinerario/${id}`), { ...data, creadoEn: now });
    });

    // Aviso
    b.set(db.collection(`operativos/${opId}/avisos`).doc(), {
      texto: '📢 Mañana la excursión sale 30 minutos antes. ¡Estar listos en el lobby a las 09:30!',
      creadoEn: now,
    });

    // Accesos
    const personas = [
      { rol: 'conductor',   refId: c1.id,  nombre: 'Carlos García',    busId: b1Id },
      { rol: 'conductor',   refId: c2.id,  nombre: 'Pablo Rodríguez',  busId: b2Id },
      { rol: 'coordinador', refId: co1.id, nombre: 'María González',   busId: b1Id },
      { rol: 'coordinador', refId: co2.id, nombre: 'Ana López',        busId: b2Id },
      ...paxData.map((p, i) => ({ rol: 'pasajero', refId: paxRefs[i].id, nombre: `${p.nombre} ${p.apellido}` })),
    ];

    const links = {};
    personas.forEach(p => {
      const tk = genToken();
      links[p.nombre] = { token: tk, link: `${base}/v/${tk}`, rol: p.rol };
      b.set(db.doc(`accesos/${tk}`), {
        opId, rol: p.rol, refId: p.refId, nombre: p.nombre, activo: true, creadoEn: now,
      });
    });

    await b.commit();

    return res.status(200).json({
      ok: true,
      mensaje: 'Operativo de prueba creado correctamente.',
      opId,
      links,
      qrParaEscanear: paxData.map(p => ({
        nombre: `${p.nombre} ${p.apellido}`,
        codigo: p.codigoAgencia,
        hotel: p.hotel,
        habitacion: p.habitacion,
        bus: p.busId === b1Id ? 'Bus 1' : 'Bus 2',
      })),
    });
  } catch (e) {
    console.error('[seed-test]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
