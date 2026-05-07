# Tasks

## 1. Manifest compartido y backend base

- [x] 1.1 Mover `SPRITE_MANIFEST` a `packages/shared/src/sprite-manifest.ts` y re-exportar desde `frontend/src/render/sprite-manifest.ts` (no romper imports actuales).
- [x] 1.2 Test unit: `SPRITE_MANIFEST` accesible desde backend y frontend con el mismo contenido.
- [x] 1.3 Cambiar `computeTmjFilename` a nombre estable (`map.tmj`) para nuevas oficinas. Test unit.
- [x] 1.4 Migración: para oficinas existentes con `tmj_filename = "map_<hash>.tmj"`, renombrar fichero a `map.tmj` y `UPDATE offices SET tmj_filename = 'map.tmj'`. Idempotente. Test integración.
- [x] 1.5 Nuevo endpoint `GET /api/offices/:id/map/raw` (admin-only) que devuelve `{ tmj: <json>, tmj_hash: <sha256 hex>, tmj_filename: "map.tmj" }`. Test integración: 200 con hash correcto, 401 sin sesión, 403 si no admin, 404 si oficina sin TMJ.

## 2. Endpoint PATCH de layers de sprites

- [x] 2.1 Test integración: `PATCH /api/offices/:id/map/sprites-layers` rechaza body inválido con 400 (zod).
- [x] 2.2 Test integración: rechaza con 401 sin sesión, con 403 si no es admin.
- [x] 2.3 Test integración: rechaza con 409 si `expected_hash` no coincide; el body de error incluye `current_hash`.
- [x] 2.4 Test integración: rechaza con 422 si algún `properties.sprite` no está en el `SPRITE_MANIFEST` server-side.
- [x] 2.5 Schema Zod nuevo (`PatchSpritesLayersSchema`) acepta `{ expected_hash, layer_order, sprites_layers, layers_visibility? }`.
- [x] 2.6 Servicio `applyLayerEdits` + `checkCoherence` con tests unit (21 passing).
- [x] 2.7 Test integración: `layer_order_missing_system_layer` → 400.
- [x] 2.8 Test integración: `layer_order_unknown_name` → 400.
- [x] 2.9 Test integración: `visibility_unknown_layer` → 400.
- [x] 2.10 Test integración: reordenar e intercalar deja TMJ con el orden esperado y preserva contenido del sistema.
- [x] 2.11 Test integración: toggle de visibilidad escribe `visible: false` y no toca el resto.
- [x] 2.12 Test integración: tras guardar, `GET .../map/raw` devuelve el nuevo hash.
- [x] 2.13 Handler PATCH en `offices.ts` adaptado al nuevo body.
- [x] 2.14 Rate limit 30 req/min/IP en el endpoint.

## 3. Escena editora Phaser

- [x] 3.1 Test unit (vitest + jsdom): `MapEditorScene.preload` carga el TMJ vía `cache.tilemap` y los sprites del manifest.
- [x] 3.2 Test unit: `MapEditorScene` pinta los sprites existentes de capas `sprites_*` con `setDepth` correcto. (cubierto indirectamente: `renderTiledSprites` ya tiene tests dedicados con asserts de `setDepth` en `tiled-sprites.test.ts`; el test de `MapEditorScene` verifica que se llama con el TMJ correcto).
- [x] 3.3 Click sobre un sprite registra `selectSprite` en el store y muestra outline cyan.
- [x] 3.4 Drag con `pointermove` mueve el sprite (granularidad pixel; snap al tile con Shift). Al `pointerup` persiste vía `moveSprite`.
- [x] 3.5 Test unit: drop sobre canvas convierte clientX/Y a worldX/Y con la cámara y llama a `addSprite` en el store; el store dispara `syncSpritesFromStore` y crea el `Phaser.Sprite`.
- [x] 3.6 Test unit: removeSprite del store destruye el sprite Phaser correspondiente.
- [x] 3.7 Implementar `frontend/src/scenes/MapEditorScene.ts` con la API mínima (versión read-only sin paneles ni interacción aún).

## 4. Panel de capas

- [x] 4.1 Test unit: panel renderiza la lista de layers del TMJ marcando system/editable.
- [x] 4.2 Test unit: crear capa `sprites_*` con nombre válido funciona; nombre inválido (regex) muestra error inline.
- [x] 4.3 Test unit: borrar capa `sprites_*` pide confirmación; sí borra todos sus sprites del estado.
- [x] 4.4 Test unit: renombrar capa `sprites_*` actualiza el nombre y todos los sprites siguen asociados.
- [x] 4.5 Capas del sistema reordenables (↑/↓ habilitados también en filas del sistema), no renombrables ni borrables (✎/✕ solo en `sprites_*`).
- [x] 4.6 Botones ↑/↓ reordenan en el `layerOrder` único del store, intercalando sistema y `sprites_*`. Tests unit con mezcla.
- [x] 4.7 Botón 👁 (toggle visibilidad) en cada fila. La escena aplica `setVisible` a la TilemapLayer y a los sprites de capas `sprites_*` correspondientes. Tests unit.
- [x] 4.8 Store: `layerOrder: string[]`, `layersVisibility: Record<string, boolean>`, `initialVisibility`, `systemLayers: Record<string, SystemLayerInfo>`. Acciones `moveLayer(name, delta)` y `toggleLayerVisibility(name)`. Tests unit (19 passing).
- [x] 4.9 `extractEditorStateFromTmj` devuelve además `layerOrder`, `layersVisibility`, `systemLayers` y `spritesLayers` indexado por nombre.
- [x] 4.10 Componente actualizado al modelo nuevo.

## 5. Panel de sprites disponibles

- [x] 5.1 Test unit: panel lista todas las entradas del `SPRITE_MANIFEST` con id y previsualización.
- [~] 5.2 Test unit: previsualización animada a tamaño reducido. **Diferido a change 025** (preview es PNG estático en 024).
- [x] 5.3 Test unit: drag desde el panel sobre el canvas inserta el sprite con su id en la capa activa.
- [x] 5.4 Test unit: si no hay capa `sprites_*` activa, hint del panel pide "Selecciona una capa".
- [x] 5.5 Implementar el componente.

## 6. Popover de propiedades del sprite

- [x] 6.1 Popover muestra id (read-only) y dropdown de tag al seleccionar un sprite. Test unit.
- [x] 6.2 Dropdown lista los `frameTags` del Aseprite cacheado en `scene.cache.json` (la escena los pasa vía `getTagsForSprite`). Test unit.
- [x] 6.3 Cambiar tag llama `setSpriteTag` en el store, lo que dispara el sync de la escena y reproduce la animación en vivo, marcando dirty. Test unit.
- [x] 6.4 Implementado en [map-editor-sprite-popover.ts](frontend/src/ui/map-editor-sprite-popover.ts).

## 7. Undo / Redo — diferido a change 025

- [~] 7.1–7.6 **Diferido a change 025**: stack de snapshots, atajos Ctrl+Z / Ctrl+Shift+Z, tests unit. El editor es funcional sin esto; undo/redo es ergonomía.

## 8. Guardado y conflict handling

- [x] 8.1 `buildPatchBody()` arma el body con `expected_hash`, `layer_order`, `sprites_layers` serializadas y `layers_visibility` solo con los toggles cambiados respecto a `initialVisibility`. Tests unit.
- [x] 8.2 200 → `markSaved(newHash)` que limpia `isDirty` y actualiza `tmjHash` + `initialVisibility`. Cubierto en `MapEditorScene.handleSave` y test del store.
- [x] 8.3 409 → `window.confirm` con opciones "Recargar" / "Cancelar". Implementado en `handleSave`.
- [x] 8.4 "Recargar" → `scene.restart()`. Implementado en `handleReload`.
- [x] 8.5 Cierre con `isDirty` muestra `window.confirm`. Implementado en `handleClose`.
- [x] 8.6 Implementación completa: botones GUARDAR / DESCARTAR / CERRAR en el HUD con estados (verde/gris según `isDirty`).

## 9. Acceso desde admin panel y permisos

- [~] 9.1 **Diferido a change 025**: e2e no-admin no ve botón.
- [~] 9.2 **Diferido a change 025**: e2e admin guarda + recarga + persiste.
- [~] 9.3 **Diferido a change 025**: e2e dos sesiones simultáneas → 409 + reload.
- [x] 9.4 Añadir botón "Editor de sprites" en el admin panel (gating por rol ya viene del HUD admin button) y wiring en `HUDScene` para arrancar `MapEditorScene` y volver a `OfficeScene` al cerrar.

## 10. Validación final

- [x] 10.1 `openspec validate --all --strict` en verde (10/10).
- [x] 10.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [x] 10.3 `pnpm test` en verde (backend 346/346, frontend 175/175, tools 42/42 = 563/563). `e2e:chromium` diferido al change 025.
