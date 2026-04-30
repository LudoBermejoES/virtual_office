# Diseño técnico: sprites animados y presencia

## A. Tiles animados de Tiled

Cada tile en Tiled puede tener un array:

```json
{
  "id": 42,
  "animation": [
    { "tileid": 42, "duration": 200 },
    { "tileid": 43, "duration": 200 }
  ]
}
```

### Backend

Extender `parseTmj` para extraer `tilesets[*].tiles[*].animation`. Persistir en una nueva columna:

```sql
ALTER TABLE office_tilesets ADD COLUMN animations_json TEXT NOT NULL DEFAULT '[]';
```

Migración `0005_tileset_animations.sql`.

### Frontend

Phaser 4 reproduce las animaciones de tiles automáticamente si el `.tmj` las contiene — pero el `tilemapTiledJSON` debe tener el array embebido. Hoy se sirve el `.tmj` raw (`/maps/:id/<tmj>`), por lo que ya funciona. **La única tarea es: no perderlo al regenerar el .tmj** (no aplica hoy, pero documentar). Test e2e que verifica una animación corre.

## B. Sprite del usuario sentado

### Asset

`frontend/public/assets/sprites/desk-sit.png`: spritesheet 128×48 (4 frames de 32×48).

### Carga

`BootScene.preload`:

```ts
this.load.spritesheet("desk-sit", "/assets/sprites/desk-sit.png", { frameWidth: 32, frameHeight: 48 });
```

`OfficeScene.create`:

```ts
this.anims.create({
  key: "desk-sit-idle",
  frames: this.anims.generateFrameNumbers("desk-sit", { start: 0, end: 3 }),
  frameRate: 4,
  repeat: -1,
});
```

### Render

`frontend/src/render/seat-sprite.ts`:

```ts
export function placeSeatSprite(scene, x, y, user) {
  const sprite = scene.add.sprite(x, y, "desk-sit").play("desk-sit-idle");
  sprite.setOrigin(0.5, 0.7); // pies sobre el centro del puesto
  sprite.setTint(rgbToInt(hslToRgb(colorForUser(user.id))));
  return sprite;
}
```

El avatar del change `011` se reposiciona a `y - 28` (encima de la cabeza del sprite).

### Pool

`SpritePool` clase utilitaria con cap de 100 instancias activas; las que quedan fuera del cap se dejan en frame 0 (estáticas).

## C. NPCs decorativos

Object layer `npcs` en `.tmj`:

```json
{
  "name": "Plant 1",
  "x": 320, "y": 480,
  "properties": [{ "name": "sprite", "value": "plant-sway" }]
}
```

### Sprites pre-registrados

| Key | Frames | Duración | Notas |
|-----|--------|----------|-------|
| `cat-idle` | 4 | 250ms | Gato lamiéndose |
| `bird-idle` | 6 | 150ms | Pájaro picoteando |
| `roomba-idle` | 4 | 100ms | Roomba parpadeando luz |
| `plant-sway` | 3 | 400ms | Planta mecida por brisa |

### Validación

Backend valida el `properties.sprite` contra un enum estricto. Cualquier otro valor se descarta con un warning en logs (no rompe el upload).

## D. Performance

- Cap duro: 100 sprites animados concurrentes.
- `SpritePool.recompute()` cada 500 ms o cuando cambia la cámara: ordena sprites por distancia al centro de cámara, anima los 100 más cercanos.
- En tests: cap reducido a 10 para detectar regresiones.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Spritesheet con frames mal alineados → render roto | Test de byte-checksum del asset en CI |
| Tinta determinística produce colores muy similares para userIds cercanos | Reusar `colorForUser` (mismo hash que avatares) |
| 200+ NPCs en `.tmj` saturan render | Cota: máx 50 NPCs por oficina |
