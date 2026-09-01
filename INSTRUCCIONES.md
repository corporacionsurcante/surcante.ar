# Novedades — PDFs de presupuesto + Notificaciones push en iPhone

## Qué se agregó

1. **PDF al final de cada cotización** (charter, receptivo, disposición y movimientos): el cliente ve una pantalla de confirmación con su N° de cotización y un botón **"📄 Descargar presupuesto en PDF"** con todos los detalles.
2. **Admin → pestaña "Cotizaciones"**: base de datos de todos los presupuestos **agrupados día a día**, con buscador, filtro por servicio, total cotizado por día y botones **Ver / Descargar PDF** de cada uno. Los PDF se generan al instante desde Firestore (no ocupan almacenamiento ni requieren plan pago).
3. **Notificaciones push en tiempo real**: el panel `/admin` ahora es instalable como app en iPhone y recibe un aviso push por cada cotización nueva, incluso con la app cerrada.

Archivos nuevos: `src/utils/pdfCotizacion.js`, `src/components/ReservaConfirmada.jsx`, `src/admin/pages/Cotizaciones.jsx`, `src/firebase/pushService.js`, `public/firebase-messaging-sw.js`, `public/manifest-admin.json`, `api/notificar.js`.

---

## Configuración necesaria (una sola vez)

### 1. Clave VAPID (consola de Firebase)

1. Firebase Console → tu proyecto → ⚙️ **Configuración del proyecto** → pestaña **Cloud Messaging**.
2. En **Certificados push web (Web Push certificates)** → **Generar par de claves**.
3. Copiá la clave y agregala en **Vercel → Settings → Environment Variables**:

```
REACT_APP_FIREBASE_VAPID_KEY = <la clave generada>
```

### 2. Service Account (para enviar los push desde el servidor)

1. Firebase Console → ⚙️ **Configuración del proyecto** → **Cuentas de servicio** → **Generar nueva clave privada** (descarga un JSON).
2. En Vercel agregá otra variable de entorno:

```
FIREBASE_SERVICE_ACCOUNT = <pegar el contenido COMPLETO del JSON en una sola línea>
```

3. Redeploy en Vercel.

### 3. Reglas de Firestore

Permitir escritura en la colección `fcm_tokens` (donde se registran los dispositivos):

```
match /fcm_tokens/{token} {
  allow read: if false;
  allow write: if request.auth != null;
}
```

(El endpoint del servidor lee los tokens con firebase-admin, que saltea las reglas.)

---

## Instalar la "app" en el iPhone (cada admin, una sola vez)

1. Abrir **Safari** en el iPhone e ir a `https://surcante-ar.vercel.app/admin` e iniciar sesión.
2. Tocar el botón **Compartir** (cuadrado con flecha) → **"Agregar a pantalla de inicio"** → Agregar. Aparece el ícono **Surcante Admin**.
3. Abrir la app **desde el ícono** de la pantalla de inicio (importante: no desde Safari).
4. Tocar **"🔔 Activar avisos"** arriba a la derecha y aceptar el permiso.

Listo: cada cotización nueva llega como notificación push al instante (requiere iOS 16.4 o superior). Repetir en cada iPhone que deba recibir avisos — se pueden registrar todos los que quieran.

## Deploy

```bash
npm install
git add . && git commit -m "PDFs de presupuesto + push admin" && git push
```

Vercel despliega automáticamente. Los datos existentes no se tocan: las cotizaciones viejas también aparecen en la pestaña Cotizaciones y generan su PDF.
