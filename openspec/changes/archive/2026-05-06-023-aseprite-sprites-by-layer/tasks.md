# Tareas: sprites Aseprite por object layer

Ciclo TDD: test (red) → implementación (green) → marcar [x].

## 1. Mover assets del gato a public

- [x] 1.1 Mover `sprites/cat/animated_cat_48x48.png` y `.json` a `frontend/public/sprites/cat/`.
- [x] 1.2 Borrar la carpeta raíz `sprites/` si queda vacía.

## 2. Manifest del frontend

- [x] 2.1 Crear `frontend/src/render/sprite-manifest.ts` con la entrada `cat` apuntando a los archivos en `/sprites/cat/`, `defaultTag: "walk"`.
- [x] 2.2 Añadir tipo `SpriteManifestEntry` y `SpriteManifest`.

## 3. Funciones puras `collectSpriteIds` y `enumerateSpritePlacements`

- [x] 3.1 (test unit) `collectSpriteIds(tmj)` con dos `sprites_*` layers y un `npcs` layer → devuelve solo ids de los `sprites_*`, deduplicados — escribir test primero.
- [x] 3.2 (test unit) Layers que no empiezan por `sprites_` se ignoran.
- [x] 3.3 (test unit) `enumerateSpritePlacements` asigna `depth` igual al índice del object layer en `tmj.layers[]`.
- [x] 3.4 (test unit) Ignora objetos no-Point (rectángulos, text) con warn.
- [x] 3.5 (test unit) Propaga property `tag` cuando existe.
- [x] 3.6 (test unit) Point sin property `sprite` se descarta con warn.
- [x] 3.7 Implementar `frontend/src/render/tiled-sprites.ts` con las dos funciones puras.

## 4. `preloadTiledSprites` y `renderTiledSprites`

- [x] 4.1 (test unit) `preloadTiledSprites` ignora ids no presentes en el manifest con warn — test primero (con scene mock).
- [x] 4.2 (test unit) No re-carga si la textura ya existe (`scene.textures.exists`).
- [x] 4.3 (test unit) `renderTiledSprites` crea un sprite por cada placement, asigna `setDepth(depth)` y llama a `play(tag)`.
- [x] 4.4 (test unit) Sprite sin `tag` y sin `defaultTag`: usa `play()` sin args (Phaser elige la primera animación).
- [x] 4.5 Implementar las dos funciones en `tiled-sprites.ts`.

## 5. Integración en `OfficeScene`

- [x] 5.1 En `preload()`: tras añadir `tilemapTiledJSON`, registrar listener `filecomplete-tilemapJSON-office` que llama a `preloadTiledSprites(this, tmj, SPRITE_MANIFEST)`.
- [x] 5.2 En `create()`: tras `map.createLayer(...)`, llamar a `renderTiledSprites(this, tmj, SPRITE_MANIFEST)` y guardar el array en `this.tiledSprites`.
- [x] 5.3 En `SHUTDOWN`: destruir todos los sprites del array.
- [x] 5.4 Verificar manualmente: tilelayer ".tmj" con un object layer `sprites_overlay` y un Point con `sprite=cat` muestra el gato animado al `depth` correcto.

## 6. Verificación

- [x] 6.1 `pnpm typecheck` global verde.
- [x] 6.2 `pnpm lint && pnpm format:check` verde.
- [x] 6.3 `pnpm test` global verde (unit nuevos + regresión).
- [x] 6.4 `openspec validate --all --strict` verde.
- [x] 6.5 Prueba manual: en `mapas/teimas.tmj` añadir un object layer `sprites_overlay` con un Point `sprite=cat` en una posición visible, re-subir y comprobar que el gato anima.
