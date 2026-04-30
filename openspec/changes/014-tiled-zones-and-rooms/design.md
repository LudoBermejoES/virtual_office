# Diseño técnico: zonas y salas Tiled

## Esquema de object layer en Tiled

El admin compone el `.tmj` con tres object layers extra (opcionales):

### `zones` (rectángulos o polígonos)

Cada object:
- `name`: string (visible en tooltip).
- `properties`:
  - `kind`: `"open" | "meeting" | "kitchen" | "phone-booth" | "hall"`.

### `rooms` (rectángulos cerrados con paredes)

Mismo formato que `zones` pero con `kind="meeting"` o `"phone-booth"`. Diferencia: implican capacidad y futura reserva.

### `labels` (puntos)

- `name`: texto a mostrar.
- `properties`:
  - `font`: `"display" | "body"` (Press Start 2P / VT323).
  - `size`: `12 | 16 | 24`.

## Parser

`backend/src/services/tiled-features.parser.ts`:

```ts
export function parseTiledFeatures(tmj: TmjJson): {
  zones: Zone[];
  rooms: Room[];
  labels: Label[];
} {
  // 1. Recorre layers; busca object layers por nombre.
  // 2. Para cada objeto: valida campos contra Zod schema.
  // 3. Para polígonos: convierte coordenadas relativas a absolutas (x,y + polygon[].x,y).
  // 4. Comprueba que cada feature está dentro de [0, mapWidth] × [0, mapHeight].
  // 5. Devuelve listas tipadas. En caso de error, lanza con mensaje claro.
}
```

Validación Zod:

```ts
const Zone = z.object({
  name: z.string().min(1).max(80).regex(/^[\w\s\-áéíóúñÁÉÍÓÚÑ]+$/),
  kind: z.enum(["open", "meeting", "kitchen", "phone-booth", "hall"]),
  geometry: z.discriminatedUnion("type", [
    z.object({ type: z.literal("rect"), x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    z.object({ type: z.literal("polygon"), points: z.array(z.object({ x: z.number(), y: z.number() })).min(3).max(64) }),
  ]),
});
```

## Esquema DB

Migración `0004_office_features.sql`:

```sql
CREATE TABLE office_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('zone', 'room', 'label')),
  name TEXT NOT NULL,
  geometry_json TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  ordinal INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX idx_office_features_office ON office_features(office_id);
```

Idempotencia: al re-subir el mapa, `DELETE FROM office_features WHERE office_id=?` y reinsertar.

## Render frontend

`frontend/src/render/zone-renderer.ts`:

```ts
export function drawZone(scene, zone, theme) {
  const color = ZONE_COLORS[zone.kind]; // usa THEME.*
  if (zone.geometry.type === "rect") {
    return scene.add.rectangle(...).setFillStyle(color, 0.15).setStrokeStyle(2, color, 0.6);
  }
  const poly = new Phaser.Geom.Polygon(zone.geometry.points);
  return scene.add.polygon(...).setFillStyle(color, 0.15);
}
```

Capa de zonas se dibuja **por debajo** de los desks (depth -10).

## Indicador HUD

En `OfficeScene`, on `pointermove` calcula la zona que contiene el puntero (precomputa `Phaser.Geom.Rectangle.Contains` / `Polygon.Contains`). Si cambia, actualiza un texto `zoneLabel` en el HUD: "📍 Cocina".

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| .tmj con 200+ objetos rompe el render | Cota dura en parser, error 413 si excede |
| Polígonos cóncavos con auto-intersección | Validación shapely-like en parser; si falla, error claro al subir |
| Nombres con XSS via tooltip HTML | Renderizar tooltip con `textContent`, no `innerHTML` |
