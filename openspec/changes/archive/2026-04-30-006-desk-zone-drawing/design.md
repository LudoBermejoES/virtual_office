# Diseño técnico: Desk Pin Placement

## Modelo

```ts
type Desk = {
  id: number;
  office_id: number;
  label: string;
  x: number;     // coord en píxeles del mapa, origen top-left (mismo sistema que Tiled)
  y: number;
  source: "manual" | "tiled";  // origen del desk
  created_at: string;
};
```

La tabla `desks` se define en la migración `0001_init` con columnas `x`, `y` y `source TEXT NOT NULL CHECK (source IN ('manual','tiled'))`.

> Nota para el change `001`: la columna `source` se añade en la migración inicial junto con el resto de campos de `desks`. Si la migración inicial ya hubiera sido aplicada en algún entorno, este change emite una migración complementaria `0002_desks_source.sql` con `ALTER TABLE`. En el flujo greenfield esperado, basta con que `001` ya la incluya.

## Constantes compartidas

`packages/shared/src/desk.ts`:

```ts
export const DESK_SIZE_PX = 48;            // ancho del cuadrado renderizado
export const DESK_HALF = DESK_SIZE_PX / 2; // 24
export const DESK_MIN_SEPARATION = DESK_SIZE_PX + 4; // 52: cuadrados sin solape, 4 px de aire
```

Backend y frontend importan estas constantes para que la validación sea idéntica.

## Endpoints

```
POST   /api/offices/:id/desks                  admin   { label, x, y }      → 201 { desk }
PATCH  /api/desks/:id                          admin   { label?, x?, y? }   → 200 { desk }
DELETE /api/desks/:id                          admin                         → 204
POST   /api/offices/:id/desks/import-from-tiled admin                       → 200 { imported, warnings }
GET    /api/offices/:id                        auth                          → 200 { office, desks: [] }
```

## Importación desde object layer Tiled

El `.tmj` puede contener un object layer con `name === "desks"`. Sus objetos se interpretan así:

| Tipo de objeto | Reglas |
|----------------|--------|
| `point: true`         | `(x, y) = (object.x, object.y)`, `label = object.name` |
| Rectángulo (`width>0`, `height>0`) | `(x, y) = (object.x + width/2, object.y + height/2)`, `label = object.name` |
| Cualquier otro (polígono, ellipse) | Ignorado con warning `unsupported_object_type` |
| Sin `name` | `label` autogenerado: `T1`, `T2`, … |

Por cada objeto:

```
1. validateDeskPlacement(x, y, mapBounds, others)
2. si label vacío → autogenerar
3. si validación falla → warning per-objeto, NO abortar
4. si label colisiona con uno existente → warning `label_taken`
5. INSERT desk con source='tiled'
```

Resultado: `{ imported: <n>, warnings: [{ objectId, reason, label?, x?, y? }] }`. La respuesta del `POST/PATCH /api/offices` también incluye este desglose (`desksImported`, `desksWarnings`).

### Re-importación manual

`POST /api/offices/:id/desks/import-from-tiled` lee el `.tmj` actual y aplica el mismo algoritmo. Política: **idempotente**. Para cada objeto del layer:

- Si ya existe un desk con `source='tiled'` y mismo `label` → skip (no toca).
- Si existe con `source='manual'` y mismo `label` → warning `label_taken_by_manual`, no sobreescribe.
- Si no existe → crea con `source='tiled'`.

Esto permite al admin: subir el mapa, retocar manualmente, volver a Tiled y añadir nuevos puestos, re-importar y obtener solo los nuevos.

## Validación geométrica

`packages/shared/src/geometry.ts`:

```ts
type ValidationError =
  | "out_of_bounds"
  | "too_close_to_existing"
  | "label_taken"
  | "office_full";

export function validateDeskPlacement(
  x: number, y: number,
  bounds: { width: number; height: number },
  others: ReadonlyArray<{ x: number; y: number }>,
): { ok: true } | { ok: false; reason: ValidationError }
```

### Reglas

- `x`, `y` enteros, `Math.round` aplicado por el server antes de persistir.
- `0 ≤ x ≤ bounds.width`, `0 ≤ y ≤ bounds.height`.
- `chebyshevDistance((x, y), (other.x, other.y)) ≥ DESK_MIN_SEPARATION` para todos los `others`.

`chebyshevDistance(a, b) = max(|a.x - b.x|, |a.y - b.y|)` — equivalente a "los cuadrados de lado `DESK_SIZE_PX` centrados no se solapan".

## Endpoint de listado

`GET /api/offices/:id`:

```json
{
  "office": { "id": 1, "name": "HQ", "map_filename": "1_a1b2c3d4e5f6.png", "map_width": 800, "map_height": 600 },
  "desks": [
    { "id": 10, "label": "A1", "x": 160, "y": 110 }
  ]
}
```

## Snap a grid del Tiled

El admin usa Shift al colocar/arrastrar para snap. El paso del grid coincide con `tile_width × tile_height` de la oficina (no un valor fijo de 8 px), de modo que los pins se alinean al grid del propio Tiled.

## Frontend `AdminMapScene`

### Eventos

```
keydown 'N'  → cambia a estado "placing"
click        → en placing: coloca pin, abre prompt de label
click drag   → si hay desk seleccionado: lo mueve; al soltar PATCH { x, y }
F2           → si hay desk seleccionado: prompt de label, PATCH { label }
del / supr   → DELETE
escape       → sale de placing
shift+move   → snap a grid 8 px
```

### Render

```
Layer 1: mapa (Image)
Layer 2: puestos guardados (Rectangle DESK_SIZE_PX, color según estado)
Layer 3: puesto en placing (Rectangle preview semi-transparente siguiendo al puntero)
Layer 4: puesto seleccionado (Rectangle con borde animado cian)
Layer 5: HUD admin: botón "Nuevo puesto" (N), lista de puestos, botón "Salir"
```

### Validación cliente

`validateDeskPlacement` importada de `packages/shared/src/geometry.ts`. Si retorna `ok: false` se muestra el motivo legible al admin sin enviar la request.

## Migración

Ninguna nueva en flujo greenfield (la columna `source` se incluye en `0001_init`). Si se aplica retroactivamente sobre una BD existente sin esa columna, se añade `0002_desks_source.sql` con `ALTER TABLE desks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cambio de mapa hace que pins queden fuera de bounds | Tras PATCH del mapa, el server marca como `invalid` los desks fuera; UI los muestra en gris con opción "mover" |
| Drag desincroniza con backend si la red es lenta | Optimistic UI: se mueve localmente, en error rollback al estado del server |
| Doble click crea dos pins solapados | Debounce 300 ms en placing |
| Cliente usa otro `DESK_SIZE_PX` | Constante en `packages/shared`, ambos extremos importan la misma |
