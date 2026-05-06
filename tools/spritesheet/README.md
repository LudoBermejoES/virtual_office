# spritesheet

CLI para apilar tiras horizontales de frames PNG en un único spritesheet vertical y generar un Tileset Tiled `.tsx` con una animación por cada tira.

Pensado para procesar packs como *Modern Interiors* donde cada animación viene en un PNG separado (p.ej. `chair_swivel.png` con 3 frames de 48×48 = 144×48).

## Uso

```bash
pnpm spritesheet <input-dir> <output.png> [opciones]
```

### Opciones

| Flag | Default | Descripción |
|------|---------|-------------|
| `--tile N` | `48` | Tamaño de frame cuadrado |
| `--duration N` | `200` | ms por frame en la animación Tiled |
| `--webp` | off | Salida WebP lossless en lugar de PNG |
| `--recursive` | off | Recorrer subdirectorios |
| `--help`, `-h` | — | Ayuda |
| `--version`, `-v` | — | Versión |

### Ejemplo

```bash
pnpm spritesheet /Users/ludo/Downloads/moderninteriors-win/3_Animated_objects mapas/animated.png
```

Genera:

- `mapas/animated.png` — spritesheet vertical
- `mapas/animated.tsx` — Tileset Tiled con animaciones declaradas

Para usarlo en un `.tmj` existente, en Tiled: `Map → Add External Tileset → seleccionar animated.tsx`.

## Limitaciones

- Solo strips horizontales de un único renglón. PNGs en grid 2D no se soportan.
- Todos los strips deben compartir el mismo `tile`.
- `frameCount` debe ser entero (`width % tile === 0`).
