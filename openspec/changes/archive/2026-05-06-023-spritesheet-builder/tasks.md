# Tareas: spritesheet CLI

Ciclo TDD: test (red) → implementación (green) → refactor → marcar [x].

## 1. Workspace y bootstrap

- [x] 1.1 Crear `tools/spritesheet/package.json` con bin, scripts y deps `sharp`, `zod`, `tsx`, `vitest`, `typescript`.
- [x] 1.2 Crear `tools/spritesheet/tsconfig.json` con la misma config estricta que `tmj-optimize`.
- [x] 1.3 Crear `tools/spritesheet/vitest.config.ts` (`environment: "node"`).
- [x] 1.4 Añadir script `spritesheet` al `package.json` raíz (mismo patrón que `tmj-optimize`).
- [x] 1.5 Ampliar `pnpm test`, `typecheck`, `lint`, `format` del root para incluir `@virtual-office/spritesheet`.
- [x] 1.6 `pnpm install` y `pnpm typecheck` global pasan.

## 2. Listado y validación de strips

- [x] 2.1 (test unit) `listStrips(dir, recursive=false)` lista solo `.png` en orden alfabético — escribir test primero.
- [x] 2.2 (test unit) Con `recursive=true` recorre subdirectorios.
- [x] 2.3 (test unit) Devuelve array vacío si no hay PNGs (sin error).
- [x] 2.4 (test unit) `validateStrip({ height, width }, tile)` acepta strip válida.
- [x] 2.5 (test unit) Rechaza con mensaje claro si `height ≠ tile`.
- [x] 2.6 (test unit) Rechaza si `width % tile ≠ 0`.
- [x] 2.7 Implementar `src/strips.ts`.

## 3. Cálculo de layout

- [x] 3.1 (test unit) `computeLayout(strips, tile)` calcula `cols = max(frameCount)`, `rows = N`, `outWidth`, `outHeight` correctos — test primero.
- [x] 3.2 (test unit) `placements[i].firstLocalId = i * cols`.
- [x] 3.3 (test unit) Strips heterogéneas (96×48, 48×48, 144×48) → cols=3, rows=3.
- [x] 3.4 Implementar `src/layout.ts`.

## 4. Composición del PNG con sharp

- [x] 4.1 (test integration) Componer 3 strips sintéticos (96×48, 144×48, 48×48) produce PNG con dimensiones esperadas — test primero.
- [x] 4.2 (test integration) Las filas con strip más estrecho mantienen transparencia a la derecha.
- [x] 4.3 (test integration) Output WebP cuando `--webp`.
- [x] 4.4 Implementar `src/compose.ts`.

## 5. Generación del `.tsx`

- [x] 5.1 (test unit) `buildTsxXml(layout, options)` produce XML con `<tileset>`, `<image>`, `tilecount = cols*rows`, `columns = cols` — test primero.
- [x] 5.2 (test unit) Strip con `frameCount > 1` genera `<tile><animation>...</animation></tile>` con N `<frame>`.
- [x] 5.3 (test unit) Strip con `frameCount === 1` genera `<tile>` con properties.name, sin `<animation>`.
- [x] 5.4 (test unit) `properties.name` contiene el basename sin extensión.
- [x] 5.5 (test unit) Caracteres especiales en filenames se escapan correctamente.
- [x] 5.6 (test unit) El XML producido se puede parsear sin errores.
- [x] 5.7 Implementar `src/tsx.ts`.

## 6. CLI y pipeline

- [x] 6.1 (test unit) `parseArgs` reconoce `<input-dir> <output.png>`, `--tile`, `--duration`, `--webp`, `--recursive`, `--help`, `--version`.
- [x] 6.2 (test unit) Falta de input-dir o output → error claro.
- [x] 6.3 (test integration) Pipeline e2e con 3 PNGs sintéticos en directorio temporal genera PNG y `.tsx` correctos.
- [x] 6.4 (test integration) Reporte stdout muestra contadores (frames totales, animaciones, tamaño).
- [x] 6.5 Implementar `src/cli.ts` y `src/pipeline.ts`.

## 7. Documentación

- [x] 7.1 `tools/spritesheet/README.md` con descripción, uso, ejemplo.
- [x] 7.2 Mención en README raíz sección Estructura del repo (junto a `tmj-optimize`).

## 8. Verificación

- [x] 8.1 `pnpm typecheck && pnpm lint && pnpm format:check` global en verde.
- [x] 8.2 `pnpm test` global en verde.
- [x] 8.3 `openspec validate --all --strict` en verde.
- [x] 8.4 Prueba manual con un directorio real (p.ej. `/Users/ludo/Downloads/moderninteriors-win/3_Animated_objects`) → verificar que el `.tsx` se abre en Tiled y las animaciones se ven.
