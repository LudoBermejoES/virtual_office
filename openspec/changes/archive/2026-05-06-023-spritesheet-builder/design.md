# Diseño: `spritesheet` CLI

## Por qué workspace separado y no añadirlo a `tmj-optimize`

- Casos de uso distintos: `tmj-optimize` reduce un bundle Tiled existente, `spritesheet` lo crea desde cero a partir de PNGs sueltos.
- Mantener responsabilidades únicas, fácil de descubrir.
- Comparten dependencias (`sharp`, `zod`) pero no código relevante.

## Layout

```
tools/
└── spritesheet/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── README.md
    ├── src/
    │   ├── cli.ts          ← parse args, llama al pipeline
    │   ├── pipeline.ts     ← orquesta los pasos
    │   ├── strips.ts       ← lista y valida PNGs del directorio
    │   ├── layout.ts       ← decide cols/rows/placements
    │   ├── compose.ts      ← componer la imagen con sharp
    │   └── tsx.ts          ← genera el XML del Tiled tileset
    └── tests/unit/
        ├── strips.test.ts
        ├── layout.test.ts
        ├── tsx.test.ts
        └── pipeline.test.ts
```

## Modelo de datos

```ts
interface Strip {
  filename: string;          // basename sin path
  fullPath: string;
  width: number;             // imagewidth
  frameCount: number;        // width / tile
}

interface Placement {
  strip: Strip;
  row: number;               // fila 0..rows-1
  firstLocalId: number;      // localId del primer tile dentro del tileset
}

interface Layout {
  tile: number;
  cols: number;
  rows: number;
  outWidth: number;
  outHeight: number;
  placements: Placement[];
  totalTiles: number;
}
```

## Algoritmo

### 1. Listado de strips

Leer `dir` (recursivo si flag), filtrar `.png` (y `.webp` si los hay) por extensión, ordenar alfabéticamente por `path` (no solo basename) para resultados deterministas con sub-directorios.

### 2. Validación

Para cada PNG:

```
sharp(path).metadata() → {width, height}
if (height !== tile) → error("strip_height_mismatch", filename, height, tile)
if (width % tile !== 0) → error("strip_width_not_multiple_of_tile", filename, width, tile)
```

### 3. Cálculo del layout

```ts
const cols = Math.max(...strips.map(s => s.frameCount));
const rows = strips.length;
const outWidth = cols * tile;
const outHeight = rows * tile;

let firstId = 0;
const placements = strips.map((s, i) => {
  const p = { strip: s, row: i, firstLocalId: firstId };
  firstId += cols; // cada fila ocupa `cols` slots aunque la strip sea más corta
  return p;
});
```

**Nota**: cada fila ocupa el ancho completo (`cols`), no solo `frameCount`. Los slots vacíos a la derecha son tiles transparentes válidos, lo cual es correcto desde el punto de vista de Tiled (sólo se referencian los `frameCount` primeros). Esto simplifica el cálculo de `firstLocalId` y evita off-by-ones.

### 4. Composición

`sharp({ create: { width: outWidth, height: outHeight, channels: 4, background: transparent } }).composite([...])`. Cada strip se pega en `(0, row * tile)` con su tamaño nativo (más estrechas → transparencia a la derecha, ya cubierto por el lienzo).

### 5. Output `.tsx`

XML manual (sin librería), generado a string. La estructura es lineal y predecible. Atributos relevantes:

- Root: `<tileset version="1.10" tiledversion="1.12.1" name="<basename del output>" tilewidth="48" tileheight="48" tilecount="<cols*rows>" columns="<cols>">`
- `<image source="<basename>" width="<outWidth>" height="<outHeight>"/>`
- Por cada strip:
  - Si `frameCount > 1`: `<tile id="<firstLocalId>"><properties><property name="name" value="<basename sin ext>"/></properties><animation>...</animation></tile>`
  - Si `frameCount === 1`: igual pero sin `<animation>`.

XML escaping: el único campo libre es el `value` de la property → `escapeXml(name)` con regex sencilla (`& < > " '`).

## CLI

`parseArgs` manual (igual que `tmj-optimize`). Args posicionales primero (`<input-dir>` y `<output.png>`), luego flags. Usar `INIT_CWD` para resolver paths relativos.

## Decisiones

### TSX vs TMJ

`.tsx` es **standalone**, reutilizable en N mapas con `<tileset firstgid="X" source="animated.tsx"/>`. Encaja con el flujo del proyecto: el admin añade tilesets a un mapa de Tiled, no genera mapas desde cero.

Si más tarde se necesita un `.tmj` minimal (con un layer de demostración), se añade en una iteración con un flag `--tmj`.

### Animaciones de un solo frame

Las que tengan `frameCount === 1` se incluyen como **tile con properties.name pero sin `<animation>`**. Así, en Tiled aparecen identificables (puedes buscarlas por nombre) pero no se animan.

### Output PNG vs WebP

PNG por defecto: máxima compatibilidad con Tiled, Phaser, cualquier visor. WebP opcional con `--webp` para reducir tamaño cuando se va a usar en producción y sabemos que el frontend lo soporta.

### Filename del `.tsx`

Junto al output: si el usuario pasa `out/animated.png`, se genera `out/animated.tsx`. Coherente con la convención de Tiled.

### Validación dura: strips horizontales

V1 solo soporta strips de una fila. Si el usuario tiene un PNG en grid 2D, le pedimos que lo recorte primero. Es una limitación honesta y clara, ampliable con flag `--rows N` en V2.

### Frame de fondo transparente

`sharp` lienzo con `background: { r:0, g:0, b:0, alpha:0 }`. Los slots no usados son completamente transparentes, lo cual es esperado.

## Riesgos

- **PNGs sin canal alpha**: si el strip original no tiene transparencia, el composite puede mostrar fondo opaco. `sharp` preserva alpha del PNG fuente; el lienzo es alpha=0. Verificable en tests.
- **Memoria con muchos PNGs grandes**: `sharp` carga cada PNG en RAM. Para 100+ PNGs grandes podría hinchar. Mitigación: procesarlos en serie y dejar que el GC libere. No optimizamos prematuramente.
- **Tilesets con `firstgid` chocan**: el `.tsx` no declara `firstgid` (se asigna al añadirlo a un `.tmj`). No es problema nuestro.

## Tests

- `strips.listStrips`: directorio con varios PNGs y un README.md → solo PNGs, ordenados.
- `strips.validateStrip`: rechaza con mensaje claro `height ≠ tile`, `width % tile ≠ 0`.
- `layout.computeLayout`: `cols = max(frameCount)`, `rows = N`, `firstLocalId` correcto.
- `tsx.buildTsxXml`: XML parseable, `tilecount = cols*rows`, animations agrupadas, frame count correcto, escape de caracteres especiales en `name`.
- `pipeline e2e`: 3 PNGs sintéticos (96×48, 144×48, 48×48) → spritesheet 144×144, .tsx con 2 animations + 1 tile estático.
