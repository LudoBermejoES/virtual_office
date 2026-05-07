## Why

Hoy, para colocar sprites Aseprite en el mapa (gato, futuras NPCs decorativas) un admin tiene que:

1. Abrir Tiled en su escritorio.
2. Editar el `.tmj` añadiendo un object layer `sprites_*`, crear Points y rellenar properties `sprite` y `tag` a mano (sin autocompletado, sin previsualización).
3. Exportar y subirlo desde el admin panel.

Esto rompe el flujo "todo en el navegador" que teníamos para reservas, asignaciones fijas, gestión de usuarios, etc., y requiere conocimiento específico de Tiled. Para iterar la decoración (mover el gato, añadir más sprites, probar animaciones distintas) el ciclo es lento y frágil.

El objetivo es **un mini-editor online, dentro del propio admin panel, que cubra el caso concreto de gestionar object layers `sprites_*`**: ver las capas existentes del mapa, crear/borrar capas `sprites_*`, y dentro de ellas insertar/mover/borrar Points con sus properties `sprite` y `tag`. NO se pretende reemplazar Tiled completo (no editamos tilelayers, ni `desks`, ni `voice_rooms`, ni se tocan tilesets). Es un editor de la capa "decoración con sprites" que ya implementó el change 023.

## What Changes

- **Nueva escena/UI admin "Editor de sprites"** accesible desde el admin panel para la oficina actual. Renderiza el mismo mapa que `OfficeScene` (vía Phaser, reusando la carga de tilemap y `renderTiledSprites`) en modo edición.
- **Panel lateral de capas** que lista los object layers del TMJ. Marca cuáles son `sprites_*` (editables aquí) y cuáles son del sistema (`desks`, `voice_rooms`, `npcs`, etc., solo lectura). Permite crear/renombrar/borrar capas `sprites_*`.
- **Panel lateral de sprites disponibles** con previsualización animada de cada entrada del `SPRITE_MANIFEST` (idle/default tag). Drag & drop sobre el canvas o "click para seleccionar + click en el mapa para colocar".
- **Interacción canvas**: insertar (placement), seleccionar, mover (drag), borrar (Supr/Delete), cambiar tag desde un popover (lista de tags del JSON Aseprite cacheado).
- **Persistencia**: nuevo endpoint `PATCH /api/offices/:id/map/sprites-layers` que recibe el conjunto completo de object layers `sprites_*` (replace, no diff) y reescribe el `.tmj` guardado en disco preservando todo lo demás (tilelayers, otros object layers, tilesets, properties de tiles). El endpoint valida con Zod, exige rol admin y rate-limita.
- **Sin colaboración multi-usuario**: pestillo optimista basado en la `mtime`/hash del TMJ. Si otro admin guardó mientras este editaba, se rechaza el guardado con `409 conflict` y la UI ofrece recargar.
- **Undo/redo local** dentro de la sesión de edición (pila en memoria, no persistente).
- **No tocamos tilesets ni tilelayers**: cualquier capa `tilelayer`, cualquier object layer cuyo nombre no empiece por `sprites_`, los tilesets, las properties de tiles y todo lo demás se preservan byte a byte (round-trip seguro).

## Impact

- **Specs afectadas**:
  - `ui-game`: nuevo capability "Editor online de sprites en el mapa" con scenarios de UI, interacción y validación.
  - `oficinas`: nuevo endpoint `PATCH /api/offices/:id/map/sprites-layers` con validación, autorización y manejo de conflictos.
- **Código nuevo**:
  - `frontend/src/scenes/MapEditorScene.ts` (escena Phaser editable).
  - `frontend/src/ui/admin/MapEditor*.tsx|ts` (paneles HTML overlay).
  - `frontend/src/render/tmj-edit.ts` (helpers para mutar object layers en memoria respetando el formato Tiled).
  - `backend/src/services/sprite-layers.ts` y handler en `backend/src/http/routes/offices.ts`.
  - Tests unit (vitest) + e2e (playwright) cubriendo cada Scenario.
- **Sin breaking changes**: `OfficeScene` sigue funcionando exactamente igual; el editor solo escribe TMJ que `OfficeScene` ya sabe leer.
- **Sin nuevas dependencias**: reutiliza Phaser, zustand, react del admin panel.
