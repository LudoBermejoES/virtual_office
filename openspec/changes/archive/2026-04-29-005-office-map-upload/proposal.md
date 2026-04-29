# Propuesta: Office Map Upload (Tiled)

## Motivación

El mapa de la oficina se diseña en [Tiled](https://www.mapeditor.org/) y se exporta como `.tmj` (Tiled JSON). El admin sube el `.tmj` junto con sus tilesets PNG/WebP. El frontend renderiza la oficina con el tilemap nativo de Phaser (`load.tilemapTiledJSON` + `addTilesetImage`). Como bonus, si el `.tmj` incluye un object layer `desks`, los puestos se importan automáticamente al subir (la creación manual posterior sigue siendo posible — change `006`).

## Alcance

**En scope:**
- Endpoint `POST /api/offices` (admin) que recibe multipart con: `name`, `tmj` (1 fichero), `tilesets` (1+ ficheros).
- Endpoint `PATCH /api/offices/:id` (admin) que reemplaza el mapa Tiled completo.
- Endpoint público autenticado `GET /api/offices` y `GET /api/offices/:id`.
- Endpoint `GET /maps/:officeId/:filename` que sirve el `.tmj` o un tileset con caché agresiva inmutable.
- Validación del `.tmj`:
  - JSON parseable, `type: "map"`, `version: "1.10"` o superior, `orientation: "orthogonal"`.
  - `tilewidth`, `tileheight` ∈ [8, 64].
  - `cells * tile ≤ 4096 px` por dimensión.
  - Tile layers con `encoding=csv` o `encoding=base64` SIN compresión.
  - ≤ 8 tilesets, todos **embebidos** (sin `source: ".tsj"` externo).
- Validación de coherencia: cada `tileset.image` referenciado en el `.tmj` aparece exactamente una vez entre los PNG/WebP subidos; cada PNG subido es referenciado por algún tileset.
- Tilesets: PNG o WebP, ≤ 2 MB cada uno, dimensiones ≥ `tilewidth × tileheight`.
- Almacenamiento por oficina: `OFFICE_MAPS_DIR/{officeId}/`.
- Frontend: modal admin con dropzone múltiple, preview con un mini-render del Tiled antes de guardar.

**Fuera de scope:**
- Tilesets externos (`source: ".tsj"`).
- Mapas isométricos / hexagonales / staggered.
- Tile layers con compresión (gzip/zlib/zstd).
- Editor visual integrado (se asume que el admin usa Tiled offline).
- Capas dinámicas / animaciones del propio Tiled (las animaciones de tiles funcionan automáticamente porque Phaser las honra, pero no las certificamos en este change).

## Dominios afectados

`oficinas`.

## Orden y dependencias

Change `005`. Depende de `001`, `002`, `003`. Compatible con la importación de desks desde object layer `desks` que se materializa en el change `006`.

## Impacto de seguridad

- El `.tmj` es JSON. Se parsea con `JSON.parse` con guardas de tamaño y validación estructural por Zod antes de tocar el filesystem.
- Los tilesets son raster (PNG/WebP). Sin SVG → sin XSS por imagen.
- MIME validado por magic bytes, no solo headers.
- Filename generado server-side con hash; el cliente no controla la ruta.
- `Content-Type` fijado al MIME real, sin sniffing.
- El `.tmj` se sirve con `Content-Type: application/json` y `X-Content-Type-Options: nosniff`.

## Rollback

Eliminar la tabla `office_tilesets`, vaciar `offices` y `OFFICE_MAPS_DIR`. Como este change introduce los Requirements del dominio `oficinas`, el rollback es total.
