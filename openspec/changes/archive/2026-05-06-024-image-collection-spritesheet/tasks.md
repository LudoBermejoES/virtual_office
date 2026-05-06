# Tareas: Image Collection mode para `spritesheet`

Ciclo TDD: test (red) → implementación (green) → marcar [x].

## 1. Manifest de frame sizes

- [x] 1.1 (test unit) `loadFrameSizesManifest(path)` parsea JSON válido y retorna `Record<filename, {fw, fh}>` — escribir test primero.
- [x] 1.2 (test unit) Manifest inexistente → retorna `{}` sin error.
- [x] 1.3 (test unit) Manifest con JSON inválido → error claro.
- [x] 1.4 Implementar `src/frame-sizes.ts`.

## 2. Detección de modo

- [x] 2.1 (test unit) `effectiveFrameSize` con manifest → usa el manifest — test primero.
- [x] 2.2 (test unit) `effectiveFrameSize` sin manifest → asume cuadrado (frame_size = height).
- [x] 2.3 (test unit) `effectiveFrameSize` con dimensiones inconsistentes (manifest declara width 144, png width 100) → error.
- [x] 2.4 (test unit) `detectMode` con todos cuadrados iguales → atlas.
- [x] 2.5 (test unit) `detectMode` con un rectangular del manifest → collection.
- [x] 2.6 (test unit) `detectMode` con cuadrados de tamaños distintos → collection.
- [x] 2.7 Implementar `src/mode-detection.ts`.

## 3. Generación del TSX Image Collection

- [x] 3.1 (test unit) `buildImageCollectionTsx(tiles, options)` produce XML con `columns="0"`, `<grid>` — test primero.
- [x] 3.2 (test unit) Cada `<tile>` lleva properties `name`, `frame_width`, `frame_height`, `frame_count`.
- [x] 3.3 (test unit) `<image source>` apunta a la subcarpeta `_assets`.
- [x] 3.4 (test unit) Sprites con `frame_count === 1` no tienen propertie `frame_count` 0 (mantiene la consistencia).
- [x] 3.5 (test unit) Multi-row PNG genera N tiles con `name__row0`, `__row1`, etc.
- [x] 3.6 Implementar `src/collection-tsx.ts`.

## 4. Copia de assets

- [x] 4.1 (test unit) `copyAssets(strips, outputDir)` crea subcarpeta `_assets` y copia cada PNG — test primero.
- [x] 4.2 (test unit) Idempotente: re-llamada con mismos archivos no falla.
- [x] 4.3 Implementar `src/collection-assets.ts`.

## 5. Pipeline integrado

- [x] 5.1 (test integration) Pipeline e2e con 3 PNGs cuadrados iguales → modo atlas, comportamiento idéntico al actual — test primero.
- [x] 5.2 (test integration) Pipeline e2e con 3 PNGs uno rectangular (manifest) → modo collection, genera TSX y subcarpeta.
- [x] 5.3 (test integration) Modo collection con grid 2D produce N tiles por PNG.
- [x] 5.4 (test integration) `--collection` fuerza el modo aunque tamaños sean iguales.
- [x] 5.5 (test integration) `--atlas` con tamaños mezclados (sin manifest, simulado) → error claro.
- [x] 5.6 Modificar `src/pipeline.ts` para bifurcar según modo detectado.

## 6. CLI

- [x] 6.1 (test unit) `parseArgs` reconoce `--collection`, `--atlas`, `--frame-sizes <path>` — test primero.
- [x] 6.2 (test unit) Output `.png` fuerza atlas; `.tsx` fuerza collection.
- [x] 6.3 Modificar `src/cli.ts` con los nuevos flags.

## 7. Documentación

- [x] 7.1 Actualizar `tools/spritesheet/README.md` con sección de Image Collection y manifest.
- [x] 7.2 Ejemplo concreto con `cat.png` (144×48) + manifest.

## 8. Verificación

- [x] 8.1 `pnpm typecheck && pnpm lint && pnpm format:check` global en verde.
- [x] 8.2 `pnpm test` global en verde (los 28 tests existentes + ~15 nuevos).
- [x] 8.3 `openspec validate --all --strict` en verde.
- [x] 8.4 Prueba manual con `mapas/spritesheets/` que tienes hoy: usar manifest para `animated_cat_48x48.png: 144×48`, generar `.tsx` Image Collection y abrirlo en Tiled para verificar que cada sprite se ve correctamente.
