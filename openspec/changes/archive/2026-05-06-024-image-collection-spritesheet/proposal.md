# Propuesta: Modo Image Collection para sprites de tamaños mezclados

## Motivación

La herramienta `spritesheet` (change 023) apila todos los strips PNG en un único atlas asumiendo que todos los frames miden `tile×tile` (default 48×48). Funciona bien para packs homogéneos como Modern Interiors `48x48`, pero **no soporta sprites de tamaños distintos** dentro del mismo directorio: por ejemplo el sprite del gato (`animated_cat_48x48.png`) tiene frames de **144×48**, mientras los demás son 48×48. Forzar todo a una grid uniforme corrompería visualmente esos sprites.

Tiled tiene una solución estándar para este caso: **Image Collection**. Es un tipo de tileset donde cada tile es una imagen independiente con sus propias dimensiones, y donde cada tile puede declarar su propia animación. Queremos que la herramienta detecte automáticamente cuándo los strips del directorio tienen tamaños mezclados y emita un `.tsx` Image Collection en lugar de un atlas uniforme.

## Alcance

**En scope:**

### A. Detección automática de modo

La herramienta inspecciona los PNGs del directorio:

- **Modo atlas (existente)**: si todos los strips tienen el mismo tamaño de frame (deducido como `gcd` por filas/columnas si pasa la validación múltiplo-de-tile actual). Emite un único PNG/WebP apilado + `.tsx` simple. Comportamiento actual de la 023, sin cambios.

- **Modo collection (nuevo)**: si los strips tienen frames de tamaños distintos. Emite **un `.tsx` Image Collection** que referencia cada PNG individual. No genera atlas: cada PNG queda referenciado en su forma original.

La detección es **automática y transparente**. Si el usuario quiere forzarlo, puede pasar `--collection` o `--atlas` explícitamente.

### B. Modo collection: estructura de salida

Dado un input dir con `cat.png` (1728×48, frames de 144×48), `butterfly.png` (192×48, frames de 48×48), `candle.png` (144×96, frames de 48×48 en grid 2D):

```
<output-dir>/
├── <basename>.tsx               ← Image Collection con 4 tiles (1 cat, 1 butterfly, 2 rows de candle)
└── <basename>_assets/
    ├── cat.png                  ← copiados desde el input dir
    ├── butterfly.png
    └── candle.png
```

El `.tsx` referencia cada PNG con ruta relativa: `<image source="<basename>_assets/cat.png" .../>`.

### C. Estructura del `.tsx` Image Collection

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.1" name="sprites" tilecount="N" columns="0">
  <grid orientation="orthogonal" width="1" height="1"/>
  <tile id="0">
    <properties>
      <property name="name" value="cat"/>
      <property name="frame_width" type="int" value="144"/>
      <property name="frame_height" type="int" value="48"/>
      <property name="frame_count" type="int" value="12"/>
    </properties>
    <image source="sprites_assets/cat.png" width="1728" height="48"/>
    <animation>
      <frame tileid="0" duration="100"/>
      ...
    </animation>
  </tile>
  <tile id="1">
    <properties>
      <property name="name" value="butterfly"/>
      <property name="frame_width" type="int" value="48"/>
      <property name="frame_height" type="int" value="48"/>
      <property name="frame_count" type="int" value="4"/>
    </properties>
    <image source="sprites_assets/butterfly.png" width="192" height="48"/>
    <animation>...</animation>
  </tile>
  ...
</tileset>
```

Decisiones:

- `columns="0"` y `<grid>` indican a Tiled que es Image Collection (vs basado en imagen única).
- `tilecount` = número de filas lógicas (1 por strip + N por grid 2D).
- Cada `<tile>` lleva como properties `name`, `frame_width`, `frame_height`, `frame_count` para que el frontend pueda registrar la animación en Phaser sin recalcular.
- Las animaciones (`<animation>`) se mantienen como ya hace la 023, con duración configurable.

### D. Detección de "tamaños mezclados"

Reglas:

1. Para cada PNG: calcular `gcd(width, height)` y comprobar si encaja con un frame cuadrado (height = N×frame_height, width = M×frame_height). Si es cuadrado y N=1 (strip horizontal de cuadrados), `frame_size = height`.
2. Si **todos** los PNGs producen el mismo `frame_size` cuadrado, modo atlas (ruta actual).
3. Si **alguno** tiene frames rectangulares (width %  height ≠ 0 cuando height es la dimensión menor) o todos no comparten `frame_size`, modo collection.

Ejemplo:
- `butterfly.png` 192×48 → cuadrado 48×48, OK.
- `cat.png` 1728×48 → ¿cuadrado? 1728/48 = 36 frames de 48×48. Pero **el filename indica `48x48`** y hemos visto que el frame real es 144×48. Es ambiguo: el strip podría ser 36 frames de 48 o 12 frames de 144.

Para resolver esto, **si el usuario lo sabe**, puede pasar un manifest:

```bash
pnpm spritesheet sprites/ output.tsx --frame-sizes "cat=144x48,butterfly=48x48"
```

Si no se pasa, **asumimos cuadrado por defecto** (height = frame_size) y el usuario tendría que renombrar el archivo o pasar el flag.

Mejor opción: **leer un manifest opcional `frame_sizes.json`** en el input dir si existe:

```json
{
  "cat.png": { "frame_width": 144, "frame_height": 48 },
  "butterfly.png": { "frame_width": 48, "frame_height": 48 }
}
```

Si el manifest no existe, asumimos cuadrado. El manifest permite expresar tamaños raros sin renombrar.

### E. CLI

```
pnpm spritesheet <input-dir> <output> [opciones]
```

- `<output>` ahora puede ser `.png` (modo atlas, fuerza atlas) o `.tsx` (modo collection, fuerza collection) o sin extensión (autodetecta).
- Nuevos flags:
  - `--collection`: fuerza modo collection.
  - `--atlas`: fuerza modo atlas (aborta si hay tamaños mezclados).
  - `--frame-sizes <manifest.json>`: ruta a manifest con frame sizes por filename.
- Resto de flags (`--tile`, `--duration`, `--webp`, `--recursive`, `--skip-invalid`) siguen igual.

### F. Reporte stdout

Modo collection:

```
Modo: Image Collection (tamaños mezclados detectados)
PNGs procesados: 309 → 720 strips/filas
Frames totales: 11089
Animaciones: 720 (+ 0 estáticos)
Assets copiados a: mapas/sprites_assets/
Tileset: mapas/sprites.tsx
```

### G. Tests

Unit:

- Detección de modo: 3 PNGs cuadrados → atlas. 2 cuadrados + 1 rectangular → collection.
- `frame_sizes.json` parsing y aplicación.
- `buildImageCollectionTsx` produce XML con `columns="0"`, `<grid>`, properties por tile.
- Pipeline e2e: input dir + manifest → genera `.tsx` y subcarpeta `_assets/` con los PNGs copiados.
- Pipeline e2e: input dir homogéneo sin manifest → mismo comportamiento que 023 (modo atlas).

### H. Documentación

- Actualizar `tools/spritesheet/README.md`: explicación de los dos modos, ejemplos.

**Fuera de scope:**

- Empaquetado bin-packed (mezclar tamaños en un solo PNG): mucho más complejo y no es el problema del usuario.
- Cambios en backend/frontend para consumir el `.tsx` Image Collection: eso será un change posterior (`025-custom-sprites-from-tsx`).
- Optimización de los PNGs copiados (no se tocan, se copian tal cual).

## Operación

- Sin migración, sin runtime impact.
- Backwards-compatible: usar `<output.png>` mantiene el comportamiento de 023.
- 28 tests existentes deben seguir pasando; añadiremos ~10-15 tests nuevos para el modo collection.
