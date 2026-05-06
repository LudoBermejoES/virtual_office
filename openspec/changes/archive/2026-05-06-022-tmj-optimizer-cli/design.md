# Diseño: `tmj-optimize`

## Por qué un workspace separado y no `backend/scripts/`

- Aísla las dependencias pesadas (`sharp` ~ 30 MB binario nativo) del backend de runtime.
- Permite ejecutarlo sin tener `backend/` configurado (no requiere `.env`, `SESSION_SECRET`, etc.).
- Sigue el patrón que ya usamos en `packages/shared` (workspace independiente con tsconfig propio).

## Layout

```
tools/
└── tmj-optimize/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── README.md
    ├── src/
    │   ├── cli.ts                ← entrypoint, parse args, llama al pipeline
    │   ├── pipeline.ts           ← orquesta los pasos
    │   ├── tmj.ts                ← Zod parsing del TMJ
    │   ├── gid.ts                ← bits de flip, remap
    │   ├── animations.ts         ← cierre transitivo
    │   ├── atlas.ts              ← composición con sharp
    │   └── output-tmj.ts         ← construcción del TMJ resultante
    ├── tests/unit/
    │   ├── gid.test.ts
    │   ├── animations.test.ts
    │   ├── output-tmj.test.ts
    │   └── pipeline-integration.test.ts
    └── fixtures/
        ├── tiny.tmj
        └── tiny-tileset-1.png  ← generados con sharp en el setup del test
```

## CLI

Sin librerías externas para parsear args (proyecto evita dependencias triviales). Implementación manual minimalista en `cli.ts`:

```ts
interface CliArgs {
  input: string;
  outDir?: string;
  padding: number;
  lossless: boolean;
  quality: number;
}

function parseArgs(argv: string[]): CliArgs { /* ... */ }
```

`--help` imprime uso y sale 0. Errores → stderr + exit 1.

`package.json`:

```json
{
  "name": "@virtual-office/tmj-optimize",
  "private": true,
  "type": "module",
  "bin": { "tmj-optimize": "./dist/cli.js" },
  "scripts": {
    "build": "tsc --build",
    "start": "tsx src/cli.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "sharp": "^0.33.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.8.3",
    "vitest": "^4.1.5"
  }
}
```

Y atajo en el root para que se invoque cómodo:

```json
// raíz
"scripts": {
  "tmj-optimize": "pnpm --filter @virtual-office/tmj-optimize start --"
}
```

Uso desde la raíz: `pnpm tmj-optimize mapas/teimas.tmj`.

## Modelo de datos

### Set de GIDs usados

```ts
interface UsedTiles {
  gids: Set<number>;        // GIDs ya con flip bits enmascarados
}
```

### Mapping output

```ts
type LocalId = number;
type OldGid = number;

interface GidMapping {
  /** Para cada GID antiguo (sin bits de flip), su nuevo local ID en el atlas único. */
  oldToNewLocal: Map<OldGid, LocalId>;
  /** Lista ordenada (índice = newLocalId) con la fuente para componer el atlas. */
  ordered: Array<{
    oldGid: OldGid;
    sourceTilesetIndex: number;
    sourceLocalId: number;
  }>;
}
```

## Algoritmo paso a paso

### 1. Parseo TMJ con Zod

`tmj.ts` define el subset de la spec Tiled que necesitamos: `version`, `orientation`, `width`, `height`, `tilewidth`, `tileheight`, `infinite`, `layers[]` (tilelayer + objectgroup), `tilesets[]`. Errores → `Error("invalid_tmj: ...")`.

### 2. Bits de flip

```ts
const FLIP_MASK = 0x1fffffff;
const FLIP_BITS = 0xe0000000;

function maskGid(gid: number): number { return gid & FLIP_MASK; }
function flipBitsOf(gid: number): number { return gid & FLIP_BITS; }
function combine(localGid: number, flipBits: number): number {
  return (localGid | flipBits) >>> 0;
}
```

Tests directos.

### 3. Resolución `gid → (tilesetIndex, localId)`

Ordenar tilesets por `firstgid` ASC. Para cada GID:
- buscar el tileset con `firstgid <= gid < nextFirstgid` (o el último si `gid >= últimoFirstgid`).
- `localId = gid - firstgid`.
- Validar que `localId < tilecount` del tileset, si no → error `corrupt_gid`.

### 4. Cierre por animaciones

`tilesets[i].tiles[k].animation` lista `tileid` destino (locales al tileset). Si el tile origen `(i, k)` está usado, todos los `tileid` destino (en el mismo tileset) deben añadirse al set como `firstgid + tileid`.

Iterar hasta punto fijo. En la práctica una sola pasada es suficiente porque las animaciones no encadenan, pero el algoritmo es transitivo por seguridad.

### 5. Construir mapping

Ordenar `Array<{oldGid, tilesetIdx, localId}>` por `(tilesetIdx, localId)` ASC. Asignar `newLocalId = 0..N-1`.

### 6. Componer el atlas con sharp

```
cols = ceil(sqrt(N))
rows = ceil(N / cols)
atlasW = cols * (tw + padding) - padding   // sin padding al final
atlasH = rows * (th + padding) - padding
```

Para cada entrada `i`:
- `srcX = sourceLocalId % sourceColumns * tw`
- `srcY = floor(sourceLocalId / sourceColumns) * th`
- `dstX = (i % cols) * (tw + padding)`
- `dstY = floor(i / cols) * (th + padding)`
- Recortar con `sharp(srcBuffer).extract({left: srcX, top: srcY, width: tw, height: th})`.
- Componer en `composite[]`.

`sharp` permite crear el lienzo con `sharp({ create: { width, height, channels: 4, background: transparent } })`. Salida `.webp({ lossless: true })` o `.webp({ quality })`.

### 7. Construir TMJ output

- `tilesets[0]`:
  ```json
  {
    "firstgid": 1,
    "name": "atlas",
    "image": "<basename>.optimized.webp",
    "imagewidth": atlasW,
    "imageheight": atlasH,
    "tilewidth": tw,
    "tileheight": th,
    "spacing": padding,
    "margin": 0,
    "columns": cols,
    "tilecount": N,
    "tiles": [/* migración de animaciones y properties */]
  }
  ```
- Para cada `tilelayer` reemplazar cada `data[i]` no-cero:
  ```ts
  const flips = flipBitsOf(rawGid);
  const old = maskGid(rawGid);
  const newLocal = mapping.oldToNewLocal.get(old)!;
  data[i] = combine(1 + newLocal, flips);
  ```
- Object layers tile-objects: misma operación sobre `object.gid`.
- `objectgroup` rectángulos/points/text: copiar tal cual.
- `infinite: false`, mantener resto de campos.

### 8. Migración de `tiles[]`

Iterar todos los `tiles` originales. Si su `id` (local en el tileset original) está usado, generar entrada en el output con:
- `id: newLocalId`.
- `properties` copiadas tal cual.
- `animation`: cada `{tileid, duration}` se remapea a su nuevo localId. Si algún destino no está en `usedTiles`, añadirlo (debe estarlo por el cierre del paso 4).

## Riesgos

### Tamaño del WebP en lossless

WebP lossless de pixel art con paleta limitada comprime muy bien (a menudo mejor que PNG). Pero si el tileset es estilo "fotográfico" (gradientes), lossy puede ser 5× más pequeño con calidad imperceptible. Por eso ofrecemos `--lossy --quality`.

### Pérdida por bordes en zoom no entero

El bleeding entre tiles ocurre cuando WebGL/Canvas interpolan al hacer zoom no múltiplo. Mitigación:
- `--padding 2` rellena con transparencia entre tiles.
- Alternativa más robusta: **extrusión** (duplicar el borde del tile en el padding). Lo dejamos fuera de scope; añadible en iteración futura como `--extrude N`.

### TMJ con tilesets externos

Tiled puede usar `*.tsx` (XML) externos. No los soportamos en V1 — error claro al usuario. Solución para el usuario: en Tiled `Map → Convert to embedded`.

### Tile global IDs ≥ 2^31

Tiled usa enteros de 32 bits unsigned. JavaScript `number` en bitwise opera como i32 (signed). Usamos `>>> 0` para forzar unsigned siempre que reescribimos el GID.

## Tests

- `gid.test.ts`: maskGid, flipBitsOf, combine. Casos: GID limpio, con flip horizontal, con vertical, con ambos.
- `animations.test.ts`: cierre transitivo. Caso A→B (B se añade), A→B y B→C (C también), animación con destino fuera de tileset (error).
- `output-tmj.test.ts`: dado un input pequeño y un mapping conocido, validar que el TMJ output tiene `data` remapeado y `tilesets[0]` correcto.
- `pipeline-integration.test.ts`: genera un PNG sintético 4×4 (`sharp({ create })`), construye un TMJ pequeño, ejecuta el pipeline completo, lee el WebP de salida y verifica dimensiones.

## Decisiones descartadas

### Usar `tiled-cli` u otra librería

No hay un equivalente Node con calidad. Las que existen están abandonadas o solo soportan a medias.

### Generar PNG en vez de WebP

WebP lossless suele ganar a PNG en este caso por compresión más moderna. PNG seguiría siendo válido para el frontend (`@fastify/static`, Phaser ambos lo aceptan), pero por defecto WebP. Si el usuario lo necesita en PNG, no es un caso de uso prioritario; lo añadimos con `--format png` en iteración futura.

### Optimización agresiva: deduplicar tiles idénticos

Si dos tiles distintos del tileset son visualmente idénticos (raro pero posible), podríamos colapsarlos en uno y remapear ambos al mismo `newLocalId`. Esto añade complejidad y un escaneo pixel-a-pixel. Lo dejamos fuera de scope.
