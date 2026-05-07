# Diseño: sprites Aseprite anclados a object layers de Tiled

## Por qué object layer y no tilelayer

Tilelayer en Tiled es una rejilla de tiles. No puede llevar Points arbitrarios, y un sprite Aseprite que mide 144×48 no encaja como tile en una grid de 48×48. Por tanto los sprites van en **object layers**.

## Por qué `sprites_*` en lugar de un único nombre

Si solo hubiera un `sprites` layer, todos los sprites quedarían al mismo Z. El admin necesita poner sprites a distintos depths (un gato detrás del sofá, otro encima de la mesa). En Tiled la única forma de expresar Z es **el orden de los layers en el panel**. Por eso permitimos múltiples object layers `sprites_below_furniture`, `sprites_overlay`, etc., y el `depth` de cada sprite se asigna según `tmj.layers[].indexOf(layer)`.

## Por qué no reusar el layer `npcs`

`npcs` es un sistema diferente:

- Sus sprites se cargan con `load.spritesheet` con `frameWidth/frameHeight` cuadrado.
- Su animación se crea manualmente en `BootScene` con `frameRate` único.
- El backend persiste sus filas en una tabla y las sirve en el snapshot porque originalmente queríamos contar/limitar NPCs.
- El depth está cementado en `setDepth(-5)`.

Mezclar Aseprite (formato JSON con duraciones por frame, tags) con el sistema NPC actual rompe la abstracción. **Sistemas separados, layers distintos**: el admin elige cuál usar según el caso.

## Por qué ignorar rectángulos en `sprites_*`

Un rectángulo en Tiled implica `width × height`, lo que sugeriría estirar el sprite. Pero Aseprite ya tiene un tamaño fijo y estirarlo deforma pixel-art. Mejor abortar con warning para guiar al admin a usar Points.

## Layout de archivos

```
frontend/
├── public/
│   └── sprites/
│       └── cat/
│           ├── animated_cat_48x48.png       ← ya en repo (movido desde sprites/)
│           └── animated_cat_48x48.json       ← ya generado
└── src/
    └── render/
        ├── sprite-manifest.ts                 ← NUEVO
        └── tiled-sprites.ts                   ← NUEVO
```

## API del módulo `tiled-sprites`

### Tipos

```ts
interface SpritePlacement {
  id: string;
  tag?: string;
  x: number;
  y: number;
  depth: number;
  layerName: string;
}
```

### Funciones puras

```ts
function collectSpriteIds(tmj: TiledMap): string[];
function enumerateSpritePlacements(tmj: TiledMap): SpritePlacement[];
```

`TiledMap` es un tipo permisivo (los layers pueden ser de varios tipos). Reusamos el subset que ya parseamos en otros sitios. No hay validación con Zod aquí: el TMJ ya pasó validación en el upload del backend.

### Funciones con efectos

```ts
function preloadTiledSprites(scene: Phaser.Scene, tmj: TiledMap, manifest: SpriteManifest): void;
function renderTiledSprites(scene: Phaser.Scene, tmj: TiledMap, manifest: SpriteManifest): Phaser.GameObjects.Sprite[];
```

`preloadTiledSprites` añade los `load.aseprite(...)` al scene loader y dispara `start()` si hace falta. Idempotente (chequea `scene.textures.exists(id)`).

`renderTiledSprites` se llama cuando los assets ya están cargados. Devuelve la lista de sprites creados para que el caller los pueda destruir en `SHUTDOWN`.

## Cuándo se ejecutan

`OfficeScene`:

```
preload() {
  this.load.tilemapTiledJSON("office", url);
  this.load.image(...) tilesets;
  // No llamar aún preloadTiledSprites: el TMJ no está leído.
  this.load.once("filecomplete-tilemapJSON-office", () => {
    const tmj = this.cache.tilemap.get("office").data;
    preloadTiledSprites(this, tmj, SPRITE_MANIFEST);
    // El loader se reinicia automáticamente cuando se añaden nuevos assets durante preload.
  });
}

create() {
  const map = this.make.tilemap({ key: "office" });
  // ... createLayer para cada tilelayer
  const tmj = this.cache.tilemap.get("office").data;
  this.tiledSprites = renderTiledSprites(this, tmj, SPRITE_MANIFEST);
}

shutdown() {
  for (const s of this.tiledSprites) s.destroy();
}
```

Si añadir assets durante el preload causa que `start()` no se reinicie, usamos un fallback: en `create`, primero verificamos si `scene.textures.exists(id)` para cada sprite usado; si no, hacemos un `load.start()` manual y diferimos `renderTiledSprites` con `load.once("complete", ...)`.

## Riesgos y mitigaciones

### El cache.tilemap puede no estar listo

`filecomplete-tilemapJSON-office` se dispara cuando el JSON está parseado, no antes. Es seguro leer `cache.tilemap.get("office").data`.

### Tags duplicados entre sprites

`createFromAseprite` crea animaciones con `key = tag` (a secas). Si dos sprites distintos tienen un tag `walk`, **se pisan**. Mitigación obvia: usar `createFromAseprite(textureKey, [tagsToCreate])` y prefijar manualmente las animation keys con el id (`scene.anims.create({ key: \`${id}:${tag}\`, ... })`). Pero eso renuncia al helper de Phaser.

Alternativa más simple: el manifest declara `defaultTag` y se documenta que los tags deben ser únicos a través del manifest si vas a usar `createFromAseprite`. Para V1, asumimos tags únicos por convención.

Si dos sprites comparten tag, el segundo `createFromAseprite` sobrescribe la animación. Phaser **no avisa**. Documentar en el README del manifest.

### Phaser y assets servidos desde Vite vs Fastify

En dev (vite serve), los archivos en `frontend/public/sprites/...` se sirven en `/sprites/...`. En producción (Fastify static), también porque mi `static` plugin sirve `frontend/dist` que copia `public/`. Verificable.

## Tests

- `tiled-sprites.test.ts`:
  - `collectSpriteIds` con TMJ minimal de dos `sprites_*` y un `npcs` → solo ids de sprites, sin duplicados.
  - `enumerateSpritePlacements` asigna `depth` igual al índice del layer en `tmj.layers[]`.
  - Ignora rectángulos y text objects (no point).
  - Property `tag` se propaga.
  - Property `sprite` ausente → punto descartado con warn.

No hay test integration porque requiere Phaser corriendo. El test manual del cat en una escena cubre la integración.

## Decisiones descartadas

- **Cargar todos los sprites del manifest aunque el TMJ no los use**: descartado, malgasta ancho de banda. `collectSpriteIds` filtra.
- **Permitir rectángulos en `sprites_*`** estirando el sprite a sus dimensiones: descartado, deforma pixel art. Mensaje claro al admin.
- **Re-usar layer `npcs`**: descartado, son sistemas distintos (ver doc principal).
