# Tasks

## 1. Undo / Redo

- [ ] 1.1 Test unit: stack `past`/`future` en el store con tope 50; cada operación atómica push-ea snapshot antes de mutar.
- [ ] 1.2 Test unit: `addSprite` + `undo()` deja el estado igual al inicial; `redo()` lo restaura.
- [ ] 1.3 Test unit: `moveSprite` + `undo()` restaura coords; `redo()` vuelve a moverlo.
- [ ] 1.4 Test unit: `removeLayer` + `undo()` trae la capa con todos sus sprites.
- [ ] 1.5 Test unit: `toggleLayerVisibility` + `undo()` invierte el toggle.
- [ ] 1.6 Test unit: `redo` se descarta tras una nueva operación (rama abandonada).
- [ ] 1.7 Test unit: stack overflow tras 51 operaciones — el snapshot más antiguo cae.
- [ ] 1.8 Implementar `undo()` y `redo()` en `mapEditorStore`. Conectar a las 9 acciones que mutan estado.
- [ ] 1.9 Listener en `MapEditorScene.mountCanvasInput()` para `Ctrl+Z` / `Cmd+Z` (undo) y `Ctrl+Shift+Z` / `Cmd+Shift+Z` (redo). Test unit.

## 2. Preview animada en panel SPRITES

- [ ] 2.1 Test unit: helper `buildSpriteAnimationCss(jsonAseprite, defaultTag)` devuelve `{ keyframes: string, animation: string }` correctos.
- [ ] 2.2 Test unit: panel monta cada item con la animación CSS aplicada.
- [ ] 2.3 Implementar.

## 3. E2E Playwright

- [ ] 3.1 Test e2e: usuario member NO ve el botón "Editor de sprites" en admin panel.
- [ ] 3.2 Test e2e: admin abre editor → crea capa `sprites_test` → arrastra `cat` → guarda → cierra → reabre → sprite persiste.
- [ ] 3.3 Test e2e: dos sesiones admin simultáneas; la segunda recibe 409 al guardar y al confirmar "Recargar" carga el TMJ del primer guardado.

## 4. Validación final

- [ ] 4.1 `openspec validate --all --strict` en verde.
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [ ] 4.3 `pnpm test && pnpm e2e:chromium` en verde.
