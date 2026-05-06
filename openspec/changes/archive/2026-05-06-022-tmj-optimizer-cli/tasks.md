# Tareas: `tmj-optimize` CLI

Ciclo TDD: test (red) → implementación (green) → refactor → marcar [x].

## 1. Workspace y bootstrap

- [x] 1.1 Añadir `tools/*` a `pnpm-workspace.yaml`.
- [x] 1.2 Crear `tools/tmj-optimize/package.json` con `bin`, `scripts` y deps `sharp`, `zod`, `tsx`, `vitest`, `typescript`.
- [x] 1.3 Crear `tools/tmj-optimize/tsconfig.json` (strict, NodeNext, target ES2024, outDir dist).
- [x] 1.4 Crear `tools/tmj-optimize/vitest.config.ts` con `environment: "node"`.
- [x] 1.5 Añadir script `tmj-optimize` al `package.json` raíz que invoca el bin del workspace.
- [x] 1.6 `pnpm install` añade dependencias y `pnpm typecheck` global pasa.

## 2. Validación TMJ con Zod

- [x] 2.1 (test unit) `parseTmj(json)` acepta TMJ ortogonal embebido válido — escribir test primero.
- [x] 2.2 (test unit) Rechaza `infinite: true` con `Error("infinite_not_supported")`.
- [x] 2.3 (test unit) Rechaza tilesets externos (`source` field) con `Error("external_tileset_not_supported")`.
- [x] 2.4 (test unit) Rechaza orientation distinta de `"orthogonal"`.
- [x] 2.5 Implementar `src/tmj.ts`.

## 3. Bits de flip y resolución de GIDs

- [x] 3.1 (test unit) `maskGid`, `flipBitsOf`, `combine` con casos de los 4 estados de flip — escribir test primero.
- [x] 3.2 (test unit) `resolveGid(gid, tilesets)` devuelve `{tilesetIndex, localId}` correcto.
- [x] 3.3 (test unit) `resolveGid` con GID corrupto (fuera de rango) lanza `Error("corrupt_gid")`.
- [x] 3.4 Implementar `src/gid.ts`.

## 4. Extracción de GIDs usados

- [x] 4.1 (test unit) `extractUsedGids(tmj)` sobre TMJ con tilelayer + objectgroup tile-objects acumula correctamente — test primero.
- [x] 4.2 (test unit) GID con bits de flip se enmascara antes de añadir al set.
- [x] 4.3 (test unit) Object layer de rectángulos no aporta GIDs.
- [x] 4.4 Implementar.

## 5. Cierre por animaciones

- [x] 5.1 (test unit) Tile A con `animation: [B]` arrastra B al set si A está usado — test primero.
- [x] 5.2 (test unit) Cierre transitivo: A→B, B→C → A usado implica B y C.
- [x] 5.3 (test unit) Animación con destino fuera del tileset lanza `Error("animation_target_out_of_tileset")`.
- [x] 5.4 Implementar `src/animations.ts`.

## 6. Construcción de mapping `oldGid → newLocalId`

- [x] 6.1 (test unit) `buildGidMapping` ordena por `(tilesetIndex, localId)` ASC y asigna `newLocalId` 0..N-1 — test primero.
- [x] 6.2 (test unit) El mapping es reproducible (mismo input → mismo output).
- [x] 6.3 Implementar.

## 7. Composición del atlas con sharp

- [x] 7.1 (test integration) Componer atlas a partir de un PNG sintético 4×4 (sharp.create) y mapping de 3 tiles produce un WebP de dimensiones esperadas.
- [x] 7.2 (test integration) `--padding 2` aumenta el atlas en 2 px entre tiles.
- [x] 7.3 Implementar `src/atlas.ts` con `composeAtlas(tilesets, mapping, options): Promise<{ buffer, cols, rows, width, height }>`.

## 8. Construcción del TMJ output

- [x] 8.1 (test unit) `buildOutputTmj(input, mapping, atlasInfo)` produce TMJ con un único tileset, `firstgid: 1`, dimensiones correctas — test primero.
- [x] 8.2 (test unit) `data[]` de cada tilelayer queda remapeado preservando flip bits.
- [x] 8.3 (test unit) Object layers de rectángulos/points se copian tal cual.
- [x] 8.4 (test unit) Object layers tile-objects con `gid` se remapean.
- [x] 8.5 (test unit) `tiles[]` migra animaciones y properties al nuevo localId.
- [x] 8.6 Implementar `src/output-tmj.ts`.

## 9. CLI (parseArgs y entrypoint)

- [x] 9.1 (test unit) `parseArgs` reconoce `<input>`, `--out-dir`, `--padding`, `--lossless`, `--lossy`, `--quality`, `--help`, `--version` — test primero.
- [x] 9.2 (test unit) Sin input → error con mensaje de uso.
- [x] 9.3 (test unit) Flags incompatibles (`--lossless --lossy`) → error.
- [x] 9.4 Implementar `src/cli.ts` con `main(argv)` y `process.exit` solo en el wrapper.
- [x] 9.5 Wire-up al pipeline completo en `src/pipeline.ts`.

## 10. Pipeline e2e

- [x] 10.1 (test integration) Pipeline completo con fixture (TMJ pequeño + 2 PNGs sintéticos) genera dos archivos en disco temporal — test primero.
- [x] 10.2 (test integration) El TMJ output vuelve a parsear con `parseTmj` y los GIDs son válidos.
- [x] 10.3 (test integration) El reporte stdout muestra "Tiles usados" y "Reducción".

## 11. Documentación

- [x] 11.1 `tools/tmj-optimize/README.md` con descripción, uso, ejemplo con `mapas/teimas.tmj`, limitaciones.
- [x] 11.2 Mención en README raíz sección "Estructura del repo" (workspaces).

## 12. Verificación

- [x] 12.1 `pnpm typecheck && pnpm lint && pnpm format:check` global en verde.
- [x] 12.2 `pnpm test` global en verde (ya incluye los tests del nuevo workspace si tu config lo recoge; si no, ajustar).
- [x] 12.3 `openspec validate --all --strict` en verde.
- [x] 12.4 Prueba manual: ejecutar `pnpm tmj-optimize mapas/teimas.tmj` y verificar tamaño reducido + visualización idéntica en Tiled.
