# spritesheet

CLI para empaquetar tiras horizontales (o grids 2D) de PNGs en un único spritesheet + Tileset Tiled `.tsx`. Detecta automáticamente si los frames son del mismo tamaño (modo atlas) o mezclan tamaños (modo Image Collection).

## Uso

```bash
pnpm spritesheet <input-dir> <output> [opciones]
```

`<output>` puede ser:

- `output.png` o `output.webp` → fuerza **modo atlas** (un único PNG/WebP + `.tsx`).
- `output.tsx` → fuerza **modo collection** (TSX Image Collection + subcarpeta `<output>_assets/` con copias de los PNGs).
- `output` (sin extensión) → autodetecta el modo según los tamaños.

### Opciones

| Flag | Default | Descripción |
|------|---------|-------------|
| `--tile N` | `48` | Tamaño de frame cuadrado para validación inicial |
| `--duration N` | `200` | ms por frame en la animación Tiled |
| `--webp` | off | Salida WebP lossless (modo atlas) |
| `--recursive` | off | Recorrer subdirectorios |
| `--skip-invalid` | off | Saltar PNGs inválidos en lugar de abortar |
| `--collection` | off | Forzar modo Image Collection |
| `--atlas` | off | Forzar modo atlas (aborta si tamaños mezclados) |
| `--frame-sizes PATH` | — | Manifest JSON con dimensiones por filename |
| `--help`, `-h` | — | Ayuda |
| `--version`, `-v` | — | Versión |

## Modos

### Modo atlas (default si todos los frames son cuadrados iguales)

Apila todos los strips PNG en un único atlas vertical. Genera:

- `output.png` (o `.webp`) — atlas vertical.
- `output.tsx` — Tileset Tiled basado en imagen.

Ideal para packs homogéneos como Modern Interiors `48x48`.

### Modo collection (cuando hay tamaños mezclados)

Mantiene cada PNG con sus dimensiones originales, copiados a una subcarpeta. Genera:

- `output.tsx` — Tileset Tiled de tipo Image Collection (`columns="0"`).
- `output_assets/` — copias de los PNGs originales.

Cada `<tile>` declara properties con `name`, `frame_width`, `frame_height`, `frame_count`, `row_index`, `duration_ms`. El frontend que cargue el `.tsx` puede usar esas properties para registrar la animación correcta en Phaser sin recalcular dimensiones.

## Manifest `frame_sizes.json`

Cuando un PNG tiene frames rectangulares (p.ej. el sprite del gato con frames 144×48 en un strip 1728×48), la herramienta no puede deducir el tamaño automáticamente. En ese caso, declara los frames en un manifest:

```json
{
  "animated_cat_48x48.png": { "frame_width": 144, "frame_height": 48 },
  "boss_big.png": { "frame_width": 96, "frame_height": 96 }
}
```

El manifest se busca automáticamente en `<input-dir>/frame_sizes.json` o se le pasa con `--frame-sizes`.

## Ejemplos

### Pack homogéneo, modo atlas

```bash
pnpm spritesheet animated_objects/ animated.png
# → animated.png + animated.tsx
```

### Pack mezclado con manifest, modo collection

```bash
# input dir tiene: cat.png (1728x48 con frames 144x48) y butterfly.png (192x48 con 48x48)
# input dir contiene también frame_sizes.json declarando cat
pnpm spritesheet sprites/ sprites.tsx
# → sprites.tsx + sprites_assets/{cat.png, butterfly.png}
```

### Forzar modo

```bash
pnpm spritesheet sprites/ out --collection
pnpm spritesheet sprites/ out --atlas
```

## Limitaciones

- Solo soporta PNG (input). Output puede ser PNG o WebP.
- Tilesets externos (`.tsx`) que el TMJ referencia deben gestionarse en Tiled aparte.
- Para PNGs rectangulares sin manifest, la herramienta aborta pidiendo el manifest.
