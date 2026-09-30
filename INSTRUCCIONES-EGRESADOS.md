# Módulo Egresados — Fase 1 (Admin)

Nueva pestaña **🎓 Egresados** en `/admin`:

- **Agencias**: alta, edición y baja de agencias de turismo estudiantil (CUIT, legajo EVT, contacto).
- **Operativos** por agencia: destino, fechas, salida (lugar, hora, presentación), regreso, contactos, info general para pasajeros. Estados: planificación → confirmado → en curso → finalizado.
- **Ómnibus**: identificación ("Bus 1") + color, unidad de la flota Surcante (toma patente, butacas y vencimiento de técnica) o unidad externa, capacidad, punto/hora de presentación propios.
- **Conductores y coordinadores**: asignados a cada ómnibus. Los conductores quedan en un padrón (`conductores`) para reutilizarlos.
- **Pasajeros**: importación desde Excel/CSV o pegando celdas (detecta columnas solo), búsqueda, filtros, asignación masiva a ómnibus y coordinador, distribución automática respetando capacidad y colegios, exportación a CSV.
- **Diagrama día a día**: actividades por hora con indicaciones separadas para pasajeros, conductores y coordinadores, por ómnibus o para todos; resumen y sugerencias del día; copiar días.
- **Links de acceso**: un link privado por persona (`/v/{token}`), envío por WhatsApp con mensaje armado, copiar, regenerar, revocar y exportar todos a Excel.
- **Controles**: sobrecupo, buses sin conductor/coordinador/unidad, licencias y técnicas que vencen durante el viaje, DNI repetidos, días sin actividades.

El portal que abren esos links (pasajero / conductor / coordinador) llega en la Fase 2. Mientras tanto, `/v/...` muestra un aviso de "acceso listo".

## Reglas de Firestore (obligatorio)

El archivo completo está en `firestore.rules` (las reglas que ya estaban + las colecciones nuevas).
Copiar todo su contenido en Firebase Console → Firestore → Reglas → **Publicar**.

Cambios respecto de las reglas anteriores:

- `isAdmin()` ahora verifica que el token tenga email (necesario para los links personales de la Fase 2).
- Nuevas colecciones `agencias`, `operativos` (y subcolecciones), `conductores` y `accesos`: lectura y escritura solo para admins.
- Todo lo demás queda igual y el cierre general (`/{document=**}` → `false`) se mantiene.

## Colecciones nuevas

| Colección | Contenido |
|---|---|
| `agencias/{id}` | Agencia cliente |
| `operativos/{opId}` | Viaje / contingente (con `agenciaId`) |
| `operativos/{opId}/buses` | Ómnibus del operativo |
| `operativos/{opId}/staff` | Conductores y coordinadores (`rol`) |
| `operativos/{opId}/pasajeros` | Pasajeros |
| `operativos/{opId}/itinerario/{AAAA-MM-DD}` | Diagrama de cada día |
| `conductores/DNI-{dni}` | Padrón de conductores Surcante |
| `accesos/{token}` | Links personales (`opId`, `rol`, `refId`) |

No requiere variables de entorno nuevas. La lectura de Excel (.xlsx/.xls) carga SheetJS desde `cdn.sheetjs.com` solo cuando se usa el importador.
