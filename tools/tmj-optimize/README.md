# tmj-optimize

CLI para optimizar bundles Tiled (`.tmj` + tilesets PNG/WebP). Produce un `.tmj` y un único `.webp` que sólo contienen los tiles realmente usados, recolocados en una grid compacta y con los GIDs del mapa remapeados.

## Uso

```bash
pnpm tmj-optimize <input.tmj> [opciones]
```

### Opciones

| Flag | Default | Descripción |
|------|---------|-------------|
| `--out-dir DIR` | junto al input | Directorio de salida |
| `--padding N` | `0` | Píxeles entre tiles del atlas (evita bleeding en zoom no entero) |
| `--lossless` | activado | WebP lossless |
| `--lossy` | desactivado | WebP lossy con `--quality` |
| `--quality N` | `90` | Calidad WebP en modo lossy (1-100) |
| `--help`, `-h` | — | Imprime ayuda |
| `--version`, `-v` | — | Imprime versión |

### Ejemplo

```bash
pnpm tmj-optimize mapas/teimas.tmj
# Genera:
#   mapas/teimas.optimized.tmj
#   mapas/teimas.optimized.webp
```

Con padding y lossy:

```bash
pnpm tmj-optimize mapas/teimas.tmj --padding 2 --lossy --quality 80 --out-dir mapas/dist
```

## Qué hace exactamente

1. Lee el `.tmj` y resuelve sus tilesets embebidos (relativos al directorio del `.tmj`).
2. Recorre todas las `tilelayer.data` y los `objectgroup` con tile-objects para acumular los GIDs realmente usados.
3. Aplica cierre transitivo: si un tile usado tiene `animation`, incluye también los tiles destino.
4. Asigna nuevos `localId` a los tiles usados, ordenando por `(tilesetIndex, sourceLocalId)` ASC para resultados deterministas.
5. Compone un atlas WebP con los tiles recolocados.
6. Reescribe el `.tmj`:
   - Un único tileset apuntando al WebP nuevo, `firstgid: 1`.
   - `data[]` remapeado preservando bits de flip (`0xE0000000`).
   - Object layers de rectángulos/points (`desks`, `voice_rooms`, ...) intactos.
   - Tile-objects con `gid` remapeados.
   - `tiles[].animation` y `tiles[].properties` migradas a los nuevos `localId`.

## Limitaciones

- **Tilesets externos** (`.tsx`): no soportados. Embeberlos antes en Tiled (`Map → Convert to embedded`).
- **Mapas infinitos**: no soportados. Convertir a finito en Tiled.
- **Orientación**: solo `orthogonal`.

## Tests

```bash
pnpm --filter @virtual-office/tmj-optimize test
pnpm --filter @virtual-office/tmj-optimize typecheck
```
