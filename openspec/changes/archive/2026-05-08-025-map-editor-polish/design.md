## Context

El editor del change 024 ya soporta `snapshot()`/`restore()` en `mapEditorStore` (se incluyó pensando en undo/redo pero no se conectó a una pila ni a atajos). Las pruebas E2E aún no existen porque no había infraestructura Playwright dedicada al editor (otros changes sí han añadido e2e: ver `frontend/tests/e2e/`).

## Decisiones

### Decisión 1: Undo/redo basado en pila de snapshots inmutables

Cada operación atómica del store (`addLayer`, `removeLayer`, `renameLayer`, `moveLayer`, `toggleLayerVisibility`, `addSprite`, `moveSprite`, `removeSprite`, `setSpriteTag`) push-ea **antes de mutar** un snapshot al stack `past`. El stack `future` se vacía. `undo()` mueve top de `past` a `future` aplicando el snapshot anterior; `redo()` al revés.

Tope de 50 entradas en cada pila. Si se sobrepasa, se descarta el snapshot más antiguo de `past`. No se persiste a localStorage ni al servidor.

**Por qué snapshots completos en vez de comandos invertibles**: el estado del editor es pequeño (capas + sprites + selección). Clonar el objeto entero es más barato que mantener un sistema de comandos con sus inversos. Y elimina toda una clase de bugs de "comando que olvida deshacer un side effect".

### Decisión 2: Operaciones agrupables vs. atómicas

Por simplicidad, **una operación = un snapshot**. Mover un sprite = un snapshot. Drag continuo del sprite NO genera 1000 snapshots: solo se push-ea al `pointerup` (cuando `moveSprite` se llama). Esto ya está en el código del 024.

### Decisión 3: Atajos `Ctrl+Z` / `Ctrl+Shift+Z`

`Cmd+Z` en macOS también, capturado por mismo handler. El listener vive en `MapEditorScene.mountCanvasInput()`. Se respeta el flag `event.repeat` para evitar repeats de SO.

### Decisión 4: E2E con Playwright reusando el patrón existente

Los tests existentes en `frontend/tests/e2e/` ya tienen helpers de auth, login admin/member, y arranque del backend de test. Los nuevos 3 tests reutilizan esos helpers. El test de "dos sesiones simultáneas" usa dos contextos Playwright en paralelo.

### Decisión 5: Preview animada con CSS, no Phaser

Phaser está cargando los aseprites igualmente. En el panel SPRITES, en vez de embebber un mini-canvas Phaser por entrada (caro), usar CSS:

```css
.sprite-preview {
  width: 32px; height: 32px;
  background-image: url(<png>);
  background-position: 0 0;
  animation: <key> <duration>ms steps(<N>) infinite;
}
@keyframes <key> {
  to { background-position: -<N*32>px 0; }
}
```

Lee del JSON cacheado: `frames["0"].frame.w/h` y total de frames del primer tag. Genera el `@keyframes` dinámico y aplica clases. Tope 1 tag por preview (el `defaultTag`).

## Risks / Trade-offs

- **Snapshots de estado completo**: si en el futuro el editor maneja TMJs con cientos de sprites por capa, clonar 50 veces puede ser costoso en memoria. Mitigación: medir y, si llega a ser problema, pasar a comandos invertibles. Para los TMJs reales (decenas de sprites máximo) no es un problema.
- **Playwright en CI**: estos tests añaden tiempo al pipeline. Aceptable: el editor es feature crítica y queremos detectar regresiones automáticamente.
- **Preview animada con CSS**: si el sprite tiene frames con diferentes duraciones, CSS `steps()` no lo respeta (asume duración uniforme). Para sprites del manifest actual todos los frames tienen la misma duración, así que es OK. Documentar la asunción en el código.

## Migration Plan

1. Añadir `past` / `future` al store + acciones `undo`/`redo`. Conectar a las acciones existentes (push antes de mutar).
2. Listener en escena para los atajos.
3. Tests unit del store (snapshots).
4. Preview animada en el panel.
5. Tests Playwright nuevos.
6. Validación + archivado.
