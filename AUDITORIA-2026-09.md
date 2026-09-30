# Auditoría del código — 30/09/2026

Revisión completa de `surcante.ar` (cotizador público, panel `/admin`, módulo Egresados, funciones `api/`,
reglas de Firestore y configuración de Vercel/Firebase). Rama: `operativa-egresados`.

## Qué estaba roto y se corrigió

### Bloqueantes
| # | Problema | Efecto | Corrección |
|---|---|---|---|
| 1 | Login del preview: el dominio `*-git-operativa-egresados-*.vercel.app` no estaba autorizado en Firebase Auth | "Error al iniciar sesión" en el preview | Dominio agregado en Firebase → Authentication → Dominios autorizados. El login ahora explica la causa de cada error. |
| 2 | Las colecciones del Diagrama (`gantt_2026`, …) no figuraban en las reglas de Firestore | **Diagrama inutilizable** (no lee ni guarda) y el cotizador nunca verificaba disponibilidad ("Verificando…" eterno) | Reglas para `gantt_AAAA` (solo admin) + colección pública mínima `ocupacion` (unidad, fechas y turnos) que el cotizador lee sin ver destinos, notas ni usuarios. |
| 3 | Las notificaciones de cotización se creaban desde el navegador del cliente y las reglas lo prohíben | **Nunca llegaba el aviso** (ni contador rojo ni push) | `api/notificar` ahora valida la reserva, crea la notificación y manda el push desde el servidor. El cliente solo envía el id de la reserva. |
| 4 | `FIREBASE_SERVICE_ACCOUNT` estaba cargada en Vercel **solo para Preview** | En surcante.com el push no podía salir aunque se arregle el punto 3 | Habilitada también para Production. |
| 5 | Pago con MercadoPago en Charter: se redirigía a MP antes de terminar de guardar | Reservas pagadas online que podían no quedar registradas | Se guarda la reserva **antes** de redirigir (`iniciarPagoOnline`). |
| 6 | Pago con MercadoPago en Receptivo: nunca se guardaba la reserva | Todas las reservas de receptivo pagadas online se perdían | Ídem 5. |
| 7 | A disposición y Movimientos: MercadoPago/Tarjeta mostraban "Integración en proceso" | Opciones de pago que no funcionaban | Pago online real (mismo flujo que Charter). |
| 8 | Usuario de Google sin permiso en `/admin` | Pantalla "Verificando acceso…" para siempre o error genérico | Se detecta, se cierra la sesión y se muestra "la cuenta X no tiene acceso". Error de red → mensaje + Reintentar. |

### Errores de datos y pantallas
- Dashboard: las columnas **Cliente** y **Fecha** estaban invertidas; "Ingresos del mes · Señas recibidas" sumaba también las señas **pendientes** (ahora solo cobradas + total cotizado del mes).
- Config → Módulos: "Movimientos CABA/GBA" no se podía desactivar (el primer toggle no hacía nada).
- Precios: si el documento no existía quedaba "Cargando…" para siempre; no se podía poner IVA/seña en 0; campos vacíos guardaban `NaN`.
- Cotizador "A disposición": leía precios de `config/disponibilidad_precios`, pero **no había dónde editarlos**. Nueva pestaña Admin → Receptivo → ⏱️ A disposición (y la pantalla inicial muestra esos mismos precios).
- Charter, paso Flota: se podía contratar **el mismo interno hasta 10 veces**. Ahora cada ómnibus físico es 0 o 1.
- Charter, paso Recorrido: si el origen quedaba a 0 km de la base o fallaba el cálculo desde la base, el botón quedaba bloqueado sin explicación.
- Detalle de presupuestos: la fila "Con impuestos" mostraba solo el IVA → ahora dice "IVA 21 %". City Tour decía "con impuestos" sobre un precio sin IVA.
- Movimientos por horas: la reserva no guardaba ni las horas ni el pack elegido.
- Reservas (admin): los servicios que no son charter mostraban "undefined → undefined"; el detalle no tenía nombre ni WhatsApp del cliente. Ahora muestra todo, con link a WhatsApp y al PDF.
- Diagrama: el día de regreso "a la mañana" marcaba también la tarde; no se podía ver otro año; un viaje de enero cargado en diciembre quedaba en la colección del año equivocado; no validaba fechas ni superposición de viajes en la misma unidad; borrar no pedía confirmación.
- Calendario: las fechas se convertían con UTC (podían correrse un día fuera de Argentina).
- Dólar: si la API fallaba se cotizaba en silencio con $1.230. Ahora usa el último valor obtenido en ese dispositivo y lo avisa en pantalla.
- Faltaban `favicon.ico`, `logo192.png` y `logo512.png` (404) y los íconos de la app instalada no eran cuadrados.

### Seguridad
- `api/notificar` aceptaba título y texto libres de cualquiera (se podía mandar push arbitrario a los admins). Ahora solo avisa reservas reales, recientes y una sola vez.
- `reservas`: solo se aceptan creadas en estado inicial (nadie puede crear una reserva "confirmada").
- `admins`: cada usuario puede consultar solo su propio documento.
- `api/crear-preferencia`: valida el monto, agrega `external_reference` = N° de cotización (para cruzar pagos de MP con reservas) y acepta la variable `MP_ACCESS_TOKEN`.

### Rendimiento
- El panel admin y la librería de PDF se descargan solo cuando se usan: el cotizador público pasó de **313 KB a 181 KB** (gzip).

## Reglas de negocio definidas (30/09/2026)
- **Movimientos en destino**: el valor del día es la **suma** de los movimientos que agrega el cliente.
  En Admin → Precios cada unidad tiene 1.er movimiento, 2.º movimiento y 3.º y siguientes (cada uno).
  Ej. Mix 60 (303,69 · 269,94 · 236,20): 1 mov = USD 303,69 · 2 mov = 573,63 · 3 mov = 809,83 · 4 mov = 1.046,03.
  Antes se tomaba un único valor según la cantidad, y un día con 2 movimientos salía más barato que con 1.
- **Configuración general conectada**: IVA, seña transferencia/efectivo, pago inicial online, km de viaje corto,
  km de estadía y km incluidos por día de movimientos se editan en Admin → Precios y los usan los cuatro
  cotizadores. Si falta un valor se usan los de siempre (21 %, 30 %, 10 %, 300 km, 800 km, 150 km).
- El paso Flota espera a tener las tarifas antes de continuar (antes, si se avanzaba rápido, podía cotizar con
  valores de respaldo viejos).

## Configuración aplicada
1. `firestore.rules` publicadas en Firebase Console (Diagrama, disponibilidad y validación de reservas).
2. Vercel → `FIREBASE_SERVICE_ACCOUNT` habilitada también para Production (avisos push en surcante.com).
3. Cada rama nueva de Vercel tiene su propio dominio de preview: para loguearse en `/admin` del preview hay que
   agregarlo en Firebase → Authentication → Dominios autorizados (o probar en surcante.com).

## Pruebas realizadas
- Build de producción en modo CI (warnings = error): OK.
- 28 pruebas unitarias: ocupación/disponibilidad (`src/utils/ocupacion.test.js`) y tarifas/parámetros
  (`src/utils/calculos.test.js`): OK.
- `api/notificar` con Firestore simulado: reserva inexistente (404), vencida (410), válida (crea notificación + push + limpia tokens vencidos), repetida (no reenvía).
- `api/crear-preferencia`: validaciones de método, token y monto.
