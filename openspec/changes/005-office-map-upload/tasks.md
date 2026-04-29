# Tareas: Office Map Upload (Tiled)

## 1. Backend: parser y validación Tiled

- [ ] 1.1 Añadir dependencias: `file-type`, `image-size`, `zod`.
- [ ] 1.2 `src/domain/tiled.ts` con schema Zod `TiledMapSchema` (orientation orthogonal, version 1.10+, tilesets embebidos, encoding csv|base64 sin compression).
- [ ] 1.3 (test unit) `TiledMapSchema` acepta un `.tmj` mínimo válido (1 tileset embebido, 1 tile layer csv).
- [ ] 1.4 (test unit) Rechaza `version: "1.9"`.
- [ ] 1.5 (test unit) Rechaza `orientation: "isometric"`.
- [ ] 1.6 (test unit) Rechaza tile layer con `compression: "zlib"`.
- [ ] 1.7 (test unit) Rechaza tileset con `source: "tiles.tsj"` (externo).
- [ ] 1.8 (test unit) Rechaza `tilewidth: 4` (fuera de rango).
- [ ] 1.9 (test unit) Rechaza mapa cuyas dimensiones totales superan 4096 px.
- [ ] 1.10 (test unit) Rechaza `image` con path traversal (`../foo.png`).

## 2. Backend: coherencia tmj ↔ tilesets

- [ ] 2.1 (test unit) `checkTilesetMatch` falla con `missing: tiles.png` si el tmj referencia un tileset no subido.
- [ ] 2.2 (test unit) `checkTilesetMatch` falla con `extra: foo.png` si se sube un PNG no referenciado.
- [ ] 2.3 (test unit) `checkTilesetMatch` ok cuando el match es 1:1.

## 3. Backend: storage

- [ ] 3.1 `src/infra/storage/office-maps.ts` con `saveBundle({ tmj, tilesets })` que crea `OFFICE_MAPS_DIR/{officeId}/`.
- [ ] 3.2 (test unit) `computeTilesetFilename(ordinal, sha)` retorna `tile_{n}_{sha[:12]}.{ext}`.
- [ ] 3.3 (test unit) `serveSafe(officeId, filename)` valida regex y existencia.

## 4. Backend: endpoints

- [ ] 4.1 Registrar `@fastify/multipart` con `limits.fileSize=2MB`, `limits.fields=20`.
- [ ] 4.2 (test integration) `POST /api/offices` admin con `.tmj` válido y 1 tileset PNG → 201; office persistida con sus campos Tiled y un `office_tilesets`.
- [ ] 4.3 (test integration) `POST` con `.tmj` malformado → 422 con `reason: "invalid_tmj"`.
- [ ] 4.4 (test integration) `POST` con tileset PNG referenciado faltante → 422 con `reason: "tileset_mismatch"` y detalle.
- [ ] 4.5 (test integration) `POST` con tileset extra no referenciado → 422 con `reason: "tileset_mismatch"`.
- [ ] 4.6 (test integration) `POST` con MIME no permitido en tileset (jpg, gif) → 415.
- [ ] 4.7 (test integration) `POST` con upload total > 10 MB → 413.
- [ ] 4.8 (test integration) `POST` con tileset cuya imagen es menor que `tile_width × tile_height` → 422 `tileset_too_small`.
- [ ] 4.9 (test integration) `PATCH /api/offices/:id` admin reemplaza tmj y tilesets; persiste nuevos filenames; los desks existentes NO se tocan.
- [ ] 4.10 (test integration) `GET /api/offices` autenticado lista oficinas con sus tilesets.
- [ ] 4.11 (test integration) `GET /api/offices/:id` devuelve `office`, `tilesets[]` y `desks: []`.
- [ ] 4.12 (test integration) `GET /maps/:officeId/{tmj_filename}` sirve `application/json` con cabeceras immutable + nosniff.
- [ ] 4.13 (test integration) `GET /maps/:officeId/tile_0_xxx.png` sirve `image/png`.
- [ ] 4.14 (test integration) `GET /maps/1/../../etc/passwd` → 400.
- [ ] 4.15 (test integration) `GET /maps/1/foo.bar` (extensión inválida) → 400.
- [ ] 4.16 (test integration) Member intenta `POST /api/offices` → 403.

## 5. Frontend: upload modal

- [ ] 5.1 Modal admin "Subir mapa Tiled" con dropzone múltiple HTML.
- [ ] 5.2 Cliente parsea localmente el `.tmj` (sin enviar) para extraer la lista de `tilesets[].image`.
- [ ] 5.3 Mostrar al usuario qué ficheros faltan o sobran respecto al tmj antes de habilitar "Guardar".
- [ ] 5.4 Validación cliente: tamaños individuales y total.
- [ ] 5.5 Submit por `fetch` multipart al endpoint.
- [ ] 5.6 En éxito, recargar la oficina; mostrar contador "N puestos importados desde Tiled" si vino del object layer (preparado para `006`).

## 6. Frontend: render con Phaser tilemap

- [ ] 6.1 `OfficeScene.preload` carga `tilemapTiledJSON("office", url)` y un `image` por tileset.
- [ ] 6.2 `OfficeScene.create` crea el tilemap, añade tilesets y crea un `TilemapLayer` por cada layer del `.tmj`.
- [ ] 6.3 (test unit FE) `domain/office.ts` calcula factor de escala dado el tamaño del canvas y `map_width × map_height`.
- [ ] 6.4 Mini-render preview en el modal: instancia Phaser con el bundle subido en memoria (vía `URL.createObjectURL`) y captura un screenshot.

## 7. E2E

- [ ] 7.1 (e2e) Admin sube `office.tmj` con 1 tileset y 1 tile layer; ve el tilemap renderizado en `OfficeScene`.
- [ ] 7.2 (e2e) Subir solo el `.tmj` sin tilesets → mensaje "Faltan tilesets: ..."; bloqueado.
- [ ] 7.3 (e2e) Subir un PDF en el slot de tmj → "Formato no permitido".
- [ ] 7.4 (e2e) Subir un mapa isométrico → mensaje "Solo orthogonal soportado".
- [ ] 7.5 (e2e) Subir un mapa con compresión zlib → mensaje "Exporta sin compresión desde Tiled".
- [ ] 7.6 (e2e) Member intenta entrar al modo admin → no aparece la opción "Subir mapa".

## 8. Verificación

- [ ] 8.1 `OFFICE_MAPS_DIR/{officeId}/` queda con 1 `.tmj` + N `.png|.webp`; subir el mismo bundle dos veces no duplica ficheros (mismo hash).
- [ ] 8.2 Coverage ≥ 80% en `domain/tiled.ts`, `infra/storage/office-maps.ts` y `http/routes/offices.ts`.
- [ ] 8.3 `pnpm test` y `pnpm e2e:chromium` en verde.
- [ ] 8.4 Logs no incluyen el contenido del `.tmj` ni rutas absolutas; solo `officeId`, `tilesetCount` y bytes totales.
