## Why

El change 024 entregó un editor online funcional para gestionar capas `sprites_*` y reordenar/visibilizar capas del sistema, persistiendo en el TMJ vía PATCH con conflict handling. Lo que quedó fuera por scope:

1. **Undo/redo** — un admin que se equivoca al mover/borrar/insertar tiene que descartar y rehacer desde cero. No es bloqueante para usar el editor pero es un rasguño constante en uso real.
2. **E2E Playwright** — todas las garantías actuales son tests unit + integración + verificación manual. No hay red de seguridad automatizada para regresiones de UI/flujo completo (admin abre → edita → guarda → recarga → persiste).
3. **Preview animada en panel SPRITES** — actualmente cada entrada del manifest se muestra como PNG estático. Una animación pequeña ayudaría a distinguir sprites a simple vista (ej. mariposa aleteando vs. estática).

## What Changes

- **Undo/redo en memoria** dentro de `mapEditorStore`: pila de snapshots con tope 50, acciones `undo()` y `redo()`, atajos `Ctrl+Z` / `Ctrl+Shift+Z` capturados desde `MapEditorScene`. Cada operación atómica que muta el estado push-ea snapshot. No persiste entre sesiones.
- **Suite Playwright** con 3 tests:
  - No-admin no ve el botón "Editor de sprites".
  - Admin abre editor, inserta sprite, guarda, recarga la oficina y el sprite persiste.
  - Dos sesiones admin simultáneas; la segunda recibe 409 y puede recargar perdiendo cambios.
- **Preview animada en panel SPRITES**: leer el JSON Aseprite cacheado, calcular `frame.w` y total de frames del primer tag, y animar el thumbnail con CSS `background-position` y `animation: steps(N) Xs infinite`.

## Impact

- **Specs afectadas**: `ui-game` (delta para undo/redo y preview animada). No toca `oficinas`.
- **Código nuevo**:
  - Acciones `undo`/`redo` en [state/map-editor.ts](frontend/src/state/map-editor.ts).
  - Listener de teclado en [scenes/MapEditorScene.ts](frontend/src/scenes/MapEditorScene.ts).
  - Mejoras en [ui/map-editor-sprites-panel.ts](frontend/src/ui/map-editor-sprites-panel.ts).
  - 3 tests Playwright en `frontend/tests/e2e/map-editor.spec.ts`.
- **Sin breaking changes**: todo aditivo sobre el editor del 024.
- **Sin nuevas dependencias**.
