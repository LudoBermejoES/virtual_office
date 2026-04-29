# Diseño técnico: Office Map Upload (Tiled)

## Modelo

```ts
type Office = {
  id: number;
  name: string;
  tmj_filename: string;        // map_{sha[:12]}.tmj
  tile_width: number;
  tile_height: number;
  cells_x: number;
  cells_y: number;
  map_width: number;           // cells_x * tile_width
  map_height: number;          // cells_y * tile_height
  tilesets: OfficeTileset[];
  created_at: string;
};

type OfficeTileset = {
  id: number;
  office_id: number;
  ordinal: number;             // posición en el array tilesets[] del .tmj
  image_name: string;          // nombre como aparece en el .tmj (p.ej. "office_tiles.png")
  filename: string;            // tile_{ordinal}_{sha[:12]}.png
  mime_type: "image/png" | "image/webp";
};
```

Las tablas `offices` y `office_tilesets` se crean en `001-project-foundation`. Este change añade los endpoints y la lógica.

## Endpoints

```
POST   /api/offices                     admin   multipart   → 201 { office }
GET    /api/offices                     auth                → 200 [{ office }]
GET    /api/offices/:id                 auth                → 200 { office, desks: [], bookings: [] }
PATCH  /api/offices/:id                 admin   multipart   → 200 { office, desksImported }
DELETE /api/offices/:id                 admin                → 204
GET    /maps/:officeId/:filename        public               → tmj o tileset
```

`GET /api/offices/:id` puede aceptar `?date=YYYY-MM-DD` (uso pleno en change `007`).

## Pipeline de subida

```
POST /api/offices
  multipart fields:
    name: string (≤ 80 chars)
    tmj: File (.tmj)
    tilesets: File[]    (uno por tileset embebido, mismo nombre que image del tmj)
```

```
1. requireAdmin
2. parsear multipart con @fastify/multipart
   - límite total 10 MB
   - límite por campo: tmj 1 MB, cada tileset 2 MB
3. tmj:
   a. validar JSON parseable
   b. Zod schema sobre el shape Tiled (campos críticos: type, version, orientation, width, height, tilewidth, tileheight, tilesets[], layers[])
   c. validar restricciones (orientación, tile size, tamaño total, encoding sin compresión, ≤ 8 tilesets, sin tilesets externos)
4. tilesets:
   a. detectar MIME real por magic bytes (png o webp); rechazar otros
   b. validar dimensiones >= tile_width × tile_height (image-size)
   c. validar que el conjunto de filenames recibidos coincide 1:1 con los `image` de los tilesets del tmj
5. computar sha256 de cada fichero
6. crear directorio OFFICE_MAPS_DIR/{nextOfficeId}/
7. escribir tmj_filename y cada tile_{ordinal}_{sha}.{ext}
8. INSERT offices + INSERT office_tilesets (uno por tileset)
9. extraer object layer "desks" si existe (change 006 lo materializa)
10. responder 201 { office, desksImported: N }
```

### Reemplazo (PATCH)

- Mismo pipeline pero UPDATE.
- Borrar archivos anteriores tras commit (best effort).
- Recalcular `desks` si el nuevo `.tmj` trae object layer "desks": en este change la decisión es **no tocar** los desks existentes (mantenerlos intactos); el change `006` define la regla concreta.

## Schema Zod del `.tmj`

```ts
const TiledMapSchema = z.object({
  type: z.literal("map"),
  version: z.string().regex(/^1\.(1[0-9]|[2-9])/),  // 1.10+
  orientation: z.literal("orthogonal"),
  renderorder: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tilewidth: z.number().int().min(8).max(64),
  tileheight: z.number().int().min(8).max(64),
  infinite: z.literal(false),
  tilesets: z.array(z.object({
    firstgid: z.number().int().positive(),
    name: z.string(),
    image: z.string(),                // nombre relativo, sin path traversal
    imagewidth: z.number().int().positive(),
    imageheight: z.number().int().positive(),
    tilewidth: z.number().int(),
    tileheight: z.number().int(),
    // sin "source": rechazamos tilesets externos
  }).strict()).min(1).max(8),
  layers: z.array(z.union([
    z.object({
      type: z.literal("tilelayer"),
      name: z.string(),
      width: z.number(), height: z.number(),
      data: z.union([z.array(z.number()), z.string()]),  // CSV string o base64 string
      encoding: z.enum(["csv", "base64"]).optional(),
      compression: z.literal("").optional(),
    }).passthrough(),
    z.object({
      type: z.literal("objectgroup"),
      name: z.string(),
      objects: z.array(z.object({
        id: z.number(), name: z.string().default(""),
        x: z.number(), y: z.number(),
        width: z.number().default(0), height: z.number().default(0),
        point: z.boolean().optional(),
        type: z.string().optional(),
      }).passthrough()),
    }).passthrough(),
  ])).min(1),
});
```

Cualquier desviación → 422 con `reason` específico.

## Validación de coherencia

```ts
function checkTilesetMatch(tmj: TiledMap, files: File[]): { ok: true } | { ok: false; reason: string; details: string[] } {
  const expected = new Set(tmj.tilesets.map(t => t.image));
  const received = new Set(files.map(f => f.filename));
  const missing = [...expected].filter(x => !received.has(x));
  const extra = [...received].filter(x => !expected.has(x));
  if (missing.length || extra.length) {
    return { ok: false, reason: "tileset_mismatch", details: [...missing.map(m => `missing: ${m}`), ...extra.map(e => `extra: ${e}`)] };
  }
  return { ok: true };
}
```

Path traversal: cada `image` del tmj se valida contra regex `^[a-zA-Z0-9_.-]+\.(png|webp)$`.

## Servir mapas

```
GET /maps/:officeId/:filename
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff
  Content-Type: application/json | image/png | image/webp
```

- `:filename` validado con regex `^(map|tile)_[a-zA-Z0-9_.\-]+\.(tmj|png|webp)$`.
- `:officeId` validado como entero positivo.
- 404 si la combinación no existe en DB ni en disco.

## Frontend

### Modal admin upload

```
┌── Subir mapa Tiled ───────────────────────────┐
│ Nombre: [____________________________]        │
│                                                │
│ ┌──────────────────────────────────────────┐ │
│ │  Drag & drop:                             │ │
│ │  - 1 fichero .tmj                         │ │
│ │  - sus tilesets (.png o .webp)            │ │
│ └──────────────────────────────────────────┘ │
│                                                │
│ Validación local:                              │
│  ✓ map.tmj                                    │
│  ✓ office_tiles.png  (referenciado en tmj)    │
│  ✗ extra.png  (no usado, será ignorado)       │
│                                                │
│ Preview:                                       │
│ [   mini-render del tilemap con Phaser   ]    │
│                                                │
│            [Cancelar]  [Guardar]              │
└────────────────────────────────────────────────┘
```

- Cliente parsea el `.tmj` localmente para extraer `tilesets[].image` y validar que están entre los ficheros adjuntos antes de enviar.
- Mini-render: cargar el tilemap con Phaser en un canvas oculto y mostrar el screenshot.

### Carga del mapa en `OfficeScene`

```ts
preload() {
  this.load.tilemapTiledJSON("office", `/maps/${officeId}/${office.tmj_filename}`);
  for (const t of office.tilesets) {
    this.load.image(`tiles:${officeId}:${t.ordinal}`, `/maps/${officeId}/${t.filename}`);
  }
}

create() {
  const map = this.make.tilemap({ key: "office" });
  const tilesets = office.tilesets.map(t =>
    map.addTilesetImage(t.image_name.replace(/\.[^.]+$/, ""), `tiles:${officeId}:${t.ordinal}`)
    // el primer arg es el `name` del tileset en el tmj, que en Tiled por defecto coincide con el image sin extensión
  );
  for (const layer of map.layers) {
    map.createLayer(layer.name, tilesets);
  }
}
```

Cada tile renderizado en una `TilemapLayer` está respaldado por una instancia de [`Phaser.Tilemaps.Tile`](https://docs.phaser.io/api-documentation/class/tilemaps-tile). En este change no manipulamos tiles individuales; el render es declarativo a partir del `.tmj`.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `.tmj` malicioso con `data` enorme | Límite de tamaño total (10 MB); Zod rechaza arrays con más de 4096×4096 entradas |
| Compresión gzip/zstd no soportada | Validador Zod rechaza con error legible; documentación dice "exportar uncompressed" |
| Tilesets externos `.tsj` en flujo Tiled del admin | Rechazo explícito con mensaje: "marca Embed in Map antes de exportar" |
| `image` del tileset con path traversal (`../etc/passwd`) | Regex estricta sobre el nombre |
| Cambio de tile_size invalida coords de desks | El backend valida bounds tras PATCH; los desks fuera quedan marcados `invalid` (gestión en change `006`) |
| Versión Tiled cambia formato del campo `data` | Versión `1.10+` requerida; fallar rápido con mensaje claro |

## Decisiones documentadas

- **Por qué solo PNG/WebP en tilesets** — son los formatos canónicos de Tiled; SVG no se usa en tilemaps; JPEG genera artifacts en bordes de tiles.
- **Por qué uncompressed** — simplifica validación y debug; el ahorro de compresión es marginal para mapas pequeños y la subida ya está limitada a 10 MB.
- **Por qué tilesets embebidos** — la API de Tiled separa map y tilesets en ficheros si se usa "Save As .tsj"; obligar embed simplifica drásticamente el upload (1 archivo source en lugar de N).
- **Por qué carpeta por oficina** — evita colisiones de nombres entre oficinas distintas y facilita borrar todo el mapa al eliminar una oficina.
