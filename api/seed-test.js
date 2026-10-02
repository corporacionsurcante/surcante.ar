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

    // ── Agencia de prueba ──────────────────────────────────────────────────
    await db.doc('agencias/agencia-test').set({
      nombre: 'Agencia de Prueba',
      creadoEn: now,
    }, { merge: true });

    // ── Operativo ──────────────────────────────────────────────────────────
    const opRef = await db.collection('operativos').add({
      nombre: 'Prueba de funcionamiento',
      destino: 'Bariloche',
      fechaInicio: diaISO(0),
      fechaFin: diaISO(6),
      estado: 'en_curso',
      agenciaId: 'agencia-test',
      agenciaNombre: 'Agencia de Prueba',
      creadoEn: now,
    });
    const opId = opRef.id;

    // ── Buses ──────────────────────────────────────────────────────────────
    const b1 = db.doc(`operativos/${opId}/buses/${db.collection('x').doc().id}`);
    const b2 = db.doc(`operativos/${opId}/buses/${db.collection('x').doc().id}`);
    const b1Id = b1.id; const b2Id = b2.id;

    // ── Staff ──────────────────────────────────────────────────────────────
    const c1  = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);
    const c2  = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);
    const co1 = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);
    const co2 = db.doc(`operativos/${opId}/staff/${db.collection('x').doc().id}`);

    // ── Pasajeros ──────────────────────────────────────────────────────────
    const paxData = [
      { nombre: 'Martín',   apellido: 'Rodríguez', dni: '30111222', codigoAgencia: 'PF-001', busId: b1Id, hotel: 'Hotel Panamericano', habitacion: '301', asiento: '1A' },
      { nombre: 'Camila',   apellido: 'Vargas',    dni: '31222333', codigoAgencia: 'PF-002', busId: b1Id, hotel: 'Hotel Panamericano', habitacion: '302', asiento: '2A' },
      { nombre: 'Nicolás',  apellido: 'Blanco',    dni: '32333444', codigoAgencia: 'PF-003', busId: b1Id, hotel: 'Hotel Panamericano', habitacion: '303', asiento: '3A' },
      { nombre: 'Valentina',apellido: 'Cruz',      dni: '33444555', codigoAgencia: 'PF-004', busId: b2Id, hotel: 'Hotel Bellevue',     habitacion: '201', asiento: '1B' },
      { nombre: 'Sebastián',apellido: 'Morales',   dni: '34555666', codigoAgencia: 'PF-005', busId: b2Id, hotel: 'Hotel Bellevue',     habitacion: '202', asiento: '2B' },
    ];
    const paxRefs = paxData.map(() => db.doc(`operativos/${opId}/pasajeros/${db.collection('x').doc().id}`));

    // ── Commit en lotes ────────────────────────────────────────────────────
    const b = db.batch();

    b.set(b1, { codigo: 'Bus 1', nombre: 'Bus 1 — Rojo', color: 'rojo', capacidad: 48, interno: '105', creadoEn: now });
    b.set(b2, { codigo: 'Bus 2', nombre: 'Bus 2 — Azul', color: 'azul', capacidad: 48, interno: '210', creadoEn: now });

    b.set(c1,  { nombre: 'Roberto', apellido: 'Ríos',    telefono: '1134567890', rol: 'conductor',   busId: b1Id, creadoEn: now });
    b.set(c2,  { nombre: 'Héctor',  apellido: 'Núñez',   telefono: '1145678901', rol: 'conductor',   busId: b2Id, creadoEn: now });
    b.set(co1, { nombre: 'Florencia',apellido: 'Soto',   telefono: '1156789012', rol: 'coordinador', busId: b1Id, creadoEn: now });
    b.set(co2, { nombre: 'Diego',   apellido: 'Herrera', telefono: '1167890123', rol: 'coordinador', busId: b2Id, creadoEn: now });

    paxData.forEach((p, i) => b.set(paxRefs[i], { ...p, creadoEn: now }));

    // ── Itinerario — 7 días ────────────────────────────────────────────────
    function actId() { return genToken().slice(0, 8); }

    const dias = [
      {
        id: diaISO(0),
        actividades: [
          { id: actId(), hora: '06:00', titulo: 'Concentración y salida', paraPasajeros: 'Punto de encuentro frente al colegio. Documentos obligatorios.', paraConductores: 'Cargar nafta antes de salir — estación YPF autopista', paraCoordinadores: 'Pasar lista completa antes de arrancar. Verificar equipaje.' },
          { id: actId(), hora: '12:00', titulo: 'Parada técnica en Neuquén', paraPasajeros: 'Almuerzo libre, 1 hora de descanso.' },
          { id: actId(), hora: '18:30', titulo: 'Llegada a Bariloche', paraPasajeros: 'Check-in hotel. Tiempo libre en el centro.' },
          { id: actId(), hora: '21:00', titulo: 'Cena de bienvenida', paraPasajeros: 'Restaurante del hotel — menú incluido.', paraCoordinadores: 'Reunión post-cena para repasar el día siguiente.' },
        ],
        notaGeneral: '🚌 ¡Arrancamos! Documentos y pase de ski listos.',
      },
      {
        id: diaISO(1),
        actividades: [
          { id: actId(), hora: '08:00', titulo: 'Desayuno', paraPasajeros: 'Bufet incluido en el hotel.' },
          { id: actId(), hora: '09:30', titulo: 'Cerro Catedral', paraPasajeros: 'Ski y snow en pistas de Catedral. Llevar ropa abrigada y lentes de sol.', paraConductores: 'Dejar en la terminal de ómnibus base cerro — recoger 17:30 mismo lugar.' },
          { id: actId(), hora: '17:30', titulo: 'Regreso al hotel', paraPasajeros: 'Ducha y descanso. Cena a las 21:00.' },
          { id: actId(), hora: '21:00', titulo: 'Cena', paraPasajeros: 'Menú incluido.' },
        ],
      },
      {
        id: diaISO(2),
        actividades: [
          { id: actId(), hora: '08:00', titulo: 'Desayuno', paraPasajeros: 'Bufet incluido.' },
          { id: actId(), hora: '10:00', titulo: 'Circuito Chico', paraPasajeros: 'Lago Nahuel Huapi, Cerro Campanario y Villa La Angostura. Vista panorámica.', paraConductores: 'Estacionar en el mirador del Campanario — máx 1h. Luego plaza Angostura.' },
          { id: actId(), hora: '13:30', titulo: 'Almuerzo libre en Villa La Angostura', paraPasajeros: 'Reunirse en la plaza a las 15:30.' },
          { id: actId(), hora: '15:30', titulo: 'Lago Espejo y Correntoso', paraPasajeros: 'Parada para fotos. Uno de los lagos más transparentes del mundo.' },
          { id: actId(), hora: '21:00', titulo: 'Cena', paraPasajeros: 'Menú incluido.' },
        ],
      },
      {
        id: diaISO(3),
        actividades: [
          { id: actId(), hora: '08:00', titulo: 'Desayuno', paraPasajeros: 'Bufet incluido.' },
          { id: actId(), hora: '09:00', titulo: 'Trekking Cerro Llao Llao', paraPasajeros: 'Caminata de 2 hs. Calzado cómodo, agua y protector solar obligatorio.', paraCoordinadores: 'Grupos de máx 15 personas. Guía certificado en el punto de encuentro.' },
          { id: actId(), hora: '12:30', titulo: 'Almuerzo en el Hotel Llao Llao', paraPasajeros: 'Uno de los hoteles más famosos de la Patagonia.' },
          { id: actId(), hora: '15:00', titulo: 'Tiempo libre en Bariloche', paraPasajeros: 'Compras, chocolate, cerveza artesanal. Reunirse en plaza Perito Moreno a las 19:00.' },
          { id: actId(), hora: '21:00', titulo: 'Cena', paraPasajeros: 'Menú incluido.' },
        ],
      },
      {
        id: diaISO(4),
        actividades: [
          { id: actId(), hora: '08:00', titulo: 'Desayuno', paraPasajeros: 'Bufet incluido.' },
          { id: actId(), hora: '09:30', titulo: 'Isla Victoria y Bosque de Arrayanes', paraPasajeros: 'Excursión en barco. Paisaje único de árboles centenarios.', paraConductores: 'Dejar en el muelle Puerto Pañuelo. Recoger 17:00 mismo muelle.' },
          { id: actId(), hora: '17:00', titulo: 'Regreso al hotel', paraPasajeros: 'Tarde libre.' },
          { id: actId(), hora: '21:00', titulo: 'Noche de egresados', paraPasajeros: 'Cena especial + actividades. El momento más esperado. 🎉', paraCoordinadores: 'Coordinar con el hotel la música y la sorpresa.' },
        ],
        notaGeneral: '🎉 ¡Noche de egresados!',
      },
      {
        id: diaISO(5),
        actividades: [
          { id: actId(), hora: '09:00', titulo: 'Desayuno (sin horario fijo)', paraPasajeros: 'Servicio extendido hasta las 11:00. Día de descanso.' },
          { id: actId(), hora: '12:00', titulo: 'Tiempo libre', paraPasajeros: 'Playa del lago, paseos, compras finales.' },
          { id: actId(), hora: '14:00', titulo: 'Almuerzo libre', paraPasajeros: 'Última comida en Bariloche. Recordá los souvenirs.' },
          { id: actId(), hora: '16:00', titulo: 'Preparación del regreso', paraPasajeros: 'Armar valijas. Check-out del hotel antes de las 18:00.', paraCoordinadores: 'Verificar que todos tengan sus pertenencias.' },
          { id: actId(), hora: '18:30', titulo: 'Salida de regreso', paraPasajeros: 'Inicio del viaje de vuelta a Buenos Aires.', paraConductores: 'Parada técnica en Zapala ~22:00. Cargar combustible en Ruta 22.' },
        ],
      },
      {
        id: diaISO(6),
        actividades: [
          { id: actId(), hora: '05:00', titulo: 'Llegada a Buenos Aires', paraPasajeros: 'Arribo estimado según tráfico. Avisar a familias con anticipación.', paraConductores: 'Dejar en el colegio — portón principal.', paraCoordinadores: 'Entregar a cada pasajero su equipaje. Pasar lista final.' },
        ],
        notaGeneral: '🏠 ¡Bienvenidos de vuelta! Gracias por este viaje increíble.',
      },
    ];

    dias.forEach(({ id, ...data }) => {
      b.set(db.doc(`operativos/${opId}/itinerario/${id}`), { ...data, creadoEn: now });
    });

    // ── Avisos iniciales ───────────────────────────────────────────────────
    b.set(db.collection(`operativos/${opId}/avisos`).doc(), {
      texto: '👋 ¡Bienvenidos al viaje de egresados! Este portal es tu guía durante todo el viaje. Podés ver el itinerario, la info de tu bus y hotel, y contactar a tu coordinador.',
      creadoEn: now,
    });
    b.set(db.collection(`operativos/${opId}/avisos`).doc(), {
      texto: '📋 Recordatorio: llevar DNI, pase de ski, ropa abrigada y protector solar para el día 2.',
      creadoEn: now,
    });

    // ── Accesos ────────────────────────────────────────────────────────────
    const personas = [
      { rol: 'conductor',   refId: c1.id,  nombre: 'Roberto Ríos',      busId: b1Id },
      { rol: 'conductor',   refId: c2.id,  nombre: 'Héctor Núñez',      busId: b2Id },
      { rol: 'coordinador', refId: co1.id, nombre: 'Florencia Soto',    busId: b1Id },
      { rol: 'coordinador', refId: co2.id, nombre: 'Diego Herrera',     busId: b2Id },
      ...paxData.map((p, i) => ({ rol: 'pasajero', refId: paxRefs[i].id, nombre: `${p.nombre} ${p.apellido}` })),
    ];

    const links = {};
    personas.forEach(p => {
      const tk = genToken();
      links[p.nombre] = { token: tk, link: `${base}/v/${tk}`, rol: p.rol };
      b.set(db.doc(`accesos/${tk}`), {
        opId, rol: p.rol, refId: p.refId, nombre: p.nombre,
        ...(p.busId ? { busId: p.busId } : {}),
        activo: true, creadoEn: now,
      });
    });

    await b.commit();

    return res.status(200).json({
      ok: true,
      mensaje: 'Operativo "Prueba de funcionamiento" creado correctamente.',
      opId,
      links,
      qrParaEscanear: paxData.map((p, i) => ({
        nombre: `${p.nombre} ${p.apellido}`,
        codigoQR: p.codigoAgencia,
        hotel: p.hotel,
        habitacion: p.habitacion,
        bus: p.busId === b1Id ? 'Bus 1 — Rojo' : 'Bus 2 — Azul',
        linkPortal: links[`${p.nombre} ${p.apellido}`]?.link,
      })),
    });
  } catch (e) {
    console.error('[seed-test]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
