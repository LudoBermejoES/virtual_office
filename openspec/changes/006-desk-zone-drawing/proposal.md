# Propuesta: Desk Pin Placement

## Motivación

Una vez subido el mapa Tiled, el admin necesita marcar dónde está cada puesto. El usuario lo describió como "un punto central, una chincheta, en el sitio donde se puede colocar alguien". Cada puesto se modela con una sola coordenada `(x, y)` sobre el mapa; el render dibuja un cuadrado de ancho fijo alrededor para que sea clicable. Hay dos vías para crear puestos:

1. **Importación automática desde Tiled**: si el `.tmj` subido en el change `005` incluye un object layer llamado `desks`, los objetos `point: true` (o rectángulos, tomando el centro) se importan como Desks usando su `name` como `label`.
2. **Colocación manual** sobre la `OfficeScene` con un click en modo admin (idéntico al diseño previo).

## Alcance

**En scope:**
- Endpoints `POST /api/offices/:id/desks`, `PATCH /api/desks/:id`, `DELETE /api/desks/:id`.
- Payload: `{ label, x, y }`.
- Constante compartida `DESK_SIZE_PX` (default 48) en `packages/shared/src/desk.ts` que define el ancho del cuadrado renderizado y el cálculo de hit-box.
- Validación: coords dentro del mapa; distancia Chebyshev ≥ `DESK_MIN_SEPARATION` con cualquier otro puesto de la misma oficina (los cuadrados no se solapan); etiqueta única por oficina.
- **Importación desde object layer Tiled "desks"** al subir o reemplazar el `.tmj` (change `005`): el backend extrae los objetos del layer y los crea como Desks; los que fallen validación se reportan como warnings sin abortar el upload.
- **Endpoint de re-importación manual** `POST /api/offices/:id/desks/import-from-tiled` que admin puede invocar para volver a leer el object layer del `.tmj` actual y materializar los desks ausentes.
- Snapping a grid de `tile_width × tile_height` con Shift en cliente (usa la geometría real del Tiled).
- `AdminMapScene` Phaser: clic coloca pin, arrastrar mueve, F2 renombra, supr borra.
- `GET /api/offices/:id` ahora devuelve `desks: [{ id, label, x, y, source: "manual" | "tiled" }]`.

**Fuera de scope:**
- Múltiples tamaños de puesto. El ancho es fijo y compartido.
- Reservar puestos (change `007`).
- Hot-spots no rectangulares (futuro).

## Dominios afectados

`puestos`. Modifica `oficinas` solo en cuanto al payload de detalle.

## Orden y dependencias

Change `006`. Depende de `005-office-map-upload`.

## Impacto de seguridad

- Solo admins pueden crear/modificar/borrar puestos.
- Validación geométrica server-side (coords y separación) para rechazar payloads abusivos.
- Límite `MAX_DESKS_PER_OFFICE` (default 200) para acotar memoria.

## Rollback

`DELETE FROM desks` y revertir endpoints. Las oficinas y mapas persisten.
