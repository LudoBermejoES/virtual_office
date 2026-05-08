# Tasks

## 1. Undo / Redo

- [x] 1.1 Test unit: stack `past`/`future` en el store con tope 50; cada operación atómica push-ea snapshot antes de mutar.
- [x] 1.2 Test unit: `addSprite` + `undo()` deja el estado igual al inicial; `redo()` lo restaura.
- [x] 1.3 Test unit: `moveSprite` + `undo()` restaura coords; `redo()` vuelve a moverlo.
- [x] 1.4 Test unit: `removeLayer` + `undo()` trae la capa con todos sus sprites.
- [x] 1.5 Test unit: `toggleLayerVisibility` + `undo()` invierte el toggle.
- [x] 1.6 Test unit: `redo` se descarta tras una nueva operación (rama abandonada).
- [x] 1.7 Test unit: stack overflow tras 51 operaciones — el snapshot más antiguo cae.
- [x] 1.8 Implementar `undo()` y `redo()` en `mapEditorStore`. Conectar a las 9 acciones que mutan estado.
- [x] 1.9 Listener en `MapEditorScene.mountCanvasInput()` para `Ctrl+Z` / `Cmd+Z` (undo) y `Ctrl+Shift+Z` / `Cmd+Shift+Z` (redo). Test unit (4 passing).

## 2. Preview animada en panel SPRITES

- [x] 2.1 Test unit: helper `buildSpriteAnimationCss(jsonAseprite, defaultTag, spriteId)` devuelve `{ keyframes, animation, keyframesName, width, height, totalFrames }` correctos. 6 tests passing.
- [x] 2.2 Test unit: panel monta cada item con la animación CSS aplicada y los `@keyframes` en `<style>` inyectado en `<head>`. Fallback a `<img>` estática cuando no hay callback.
- [x] 2.3 Implementado en [map-editor-sprites-panel.ts](frontend/src/ui/map-editor-sprites-panel.ts) y [map-editor-sprites-panel-animation.ts](frontend/src/ui/map-editor-sprites-panel-animation.ts).

## 3. E2E Playwright — diferido

- [~] 3.1 **Diferido**: e2e member NO ve botón "Editor de sprites".
- [~] 3.2 **Diferido**: e2e admin abre editor → crea capa → arrastra → guarda → reabre → persiste.
- [~] 3.3 **Diferido**: e2e dos sesiones simultáneas → 409 + recargar.

## 4. Validación final

- [x] 4.1 `openspec validate --all --strict` en verde (10/10).
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [x] 4.3 `pnpm test` en verde (backend 346 + frontend 195 + tools 42 = 583). `e2e:chromium` se ejecuta en CI, no se valida localmente.
