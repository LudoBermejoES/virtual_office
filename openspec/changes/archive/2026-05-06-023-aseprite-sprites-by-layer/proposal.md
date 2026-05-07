# Propuesta: Sprites Aseprite anclados a object layers de Tiled con depth respetado

## Motivación

Hoy los NPCs decorativos del mapa (gato, pájaro, roomba, planta) se cargan desde un enum hardcoded en `npc-renderer.ts` y se pintan con `setDepth(-5)` fijo. No hay forma de:

1. **Decidir desde Tiled** si un sprite va encima o debajo de un tilelayer concreto. Por ejemplo: gato detrás del sofá vs gato por delante.
2. **Añadir sprites animados con timings precisos** (multi-frame, frame durations distintos por frame). El sistema actual usa `frameRate` único.
3. **Iterar sin tocar el enum**: queremos poder añadir un sprite nuevo poniendo el PNG+JSON en `frontend/public/sprites/` y actualizando un manifest, sin cambiar el parser ni el backend.

El formato Aseprite (PNG + JSON hash) es el estándar de la industria para pixel-art animado y Phaser lo soporta nativamente con `load.aseprite()` + `createFromAseprite()`. Phaser respeta automáticamente los `duration` de cada frame y los tags como animaciones nombradas.

## Alcance

**En scope:**

### A. Convención Tiled: object layers `sprites_*`

Cualquier object layer del TMJ cuyo nombre **empiece por `sprites_`** (por ejemplo `sprites_below_furniture`, `sprites_overlay`, `sprites_floor`) se interpreta como capa de sprites Aseprite.

- El sufijo (`below_furniture`, etc.) es libre y solo identifica al layer en Tiled; Phaser no lo usa.
- El **orden Z** del sprite viene del **índice del object layer en `tmj.layers[]`**: si el object layer está en la posición 5 del array, los sprites de ese layer reciben `setDepth(5)`. Esto permite que el admin coloque el object layer entre dos tilelayers cualesquiera y los sprites queden visualmente por encima/debajo según la posición en Tiled.
- **Solo Points** (objetos con `point: true`). Rectángulos o text objects en estos layers se ignoran con un warning en consola.

### B. Property `sprite` y opcional `tag` en cada Point

- `sprite` (string, requerido): identificador del sprite en el manifest del frontend. Si el id no está en el manifest, el Point se ignora con un `console.warn`.
- `tag` (string, opcional): nombre del tag de la animación Aseprite a reproducir (por ejemplo `walk`, `idle`). Si se omite, se usa el `defaultTag` del manifest, y si tampoco lo hay, la primera animación creada por `createFromAseprite()`.

### C. Manifest del frontend

`frontend/src/render/sprite-manifest.ts`:

```ts
export interface SpriteManifestEntry {
  png: string;
  json: string;
  defaultTag?: string;
}

export const SPRITE_MANIFEST: Record<string, SpriteManifestEntry> = {
  cat: {
    png: "/sprites/cat/animated_cat_48x48.png",
    json: "/sprites/cat/animated_cat_48x48.json",
    defaultTag: "walk",
  },
};
```

Los archivos físicos viven en `frontend/public/sprites/<id>/` para servirse como assets estáticos.

### D. Servicio `tiled-sprites`

Nuevo módulo `frontend/src/render/tiled-sprites.ts` con dos funciones puras:

- `collectSpriteIds(tmj)` → devuelve la lista de ids únicos referenciados en cualquier `objectgroup` cuyo nombre empiece por `sprites_`. Útil para preload.
- `enumerateSpritePlacements(tmj)` → devuelve `Array<{ id: string; tag?: string; x: number; y: number; depth: number; layerName: string }>` con todos los Points válidos de cualquier `sprites_*` layer.

`preloadTiledSprites(scene, tmj, manifest)`:
- Para cada id retornado por `collectSpriteIds`:
  - Si el id no está en el manifest, `console.warn` y se ignora.
  - Si la animación ya existe (`scene.anims.exists`), no recargar.
  - Llama a `scene.load.aseprite(id, manifest[id].png, manifest[id].json)`.

`renderTiledSprites(scene, tmj, manifest)`:
- Tras todos los `map.createLayer()` y la creación de animaciones, llama a `enumerateSpritePlacements` y para cada placement:
  - `scene.anims.createFromAseprite(id)` (idempotente, Phaser ignora si ya existe).
  - `const sprite = scene.add.sprite(x, y, id).setDepth(depth)`.
  - `sprite.play({ key: tag ?? manifest[id].defaultTag ?? <primera animación de id>, repeat: -1 })`.
- Devuelve la lista de sprites creados para limpieza en `SHUTDOWN`.

### E. Integración en `OfficeScene`

- En `preload()`: el TMJ aún no está cargado (el preload de Phaser carga el JSON del mapa). Tras `filecomplete-tilemapJSON`, leer `cache.tilemap` y disparar `preloadTiledSprites` con `scene.load.start()`.
- En `create()`: después del bucle `map.createLayer(...)` y antes de `renderDesks`, llamar a `renderTiledSprites(this, this.cache.tilemap.get(...).data, SPRITE_MANIFEST)` y guardar el array para destrucción en SHUTDOWN.

### F. JSON Aseprite del gato (ya generado en sesión anterior)

`sprites/cat/animated_cat_48x48.json` ya existe con 12 frames de 144×48, tag `walk`, duration 100ms por frame. Esa carpeta se mueve a `frontend/public/sprites/cat/` para ser servible por Vite/Fastify.

### G. Tests

Unit:

- `collectSpriteIds(tmj)` con TMJ con dos `sprites_*` layers y un `npcs` layer → solo ids de los `sprites_*`, deduplicados.
- `enumerateSpritePlacements(tmj)` calcula `depth` correcto según orden en `layers[]`.
- `enumerateSpritePlacements` ignora rectángulos / text objects (no points) con warning.
- Manifest sin entrada para un id → `preloadTiledSprites` no carga nada y emite warn.

Integration (manual): subir un TMJ con un object layer `sprites_overlay` con un Point `sprite=cat`, abrir la escena y verificar que el gato anima.

**Fuera de scope:**

- Subir sprites custom desde el panel admin (lo que descartamos antes en 025).
- Backend cambia. El parser de NPCs sigue como está; el sistema `sprites_*` vive solo en el frontend porque la información se lee directamente del TMJ que ya se sirve estáticamente.
- Multi-tag dinámico: el Point especifica un tag fijo. Cambiar de `walk` a `idle` en runtime requeriría WS u otro mecanismo, fuera del scope.
- Eventos al hacer click en un sprite (interactividad).

## Operación

- Sin migración SQL.
- Sin endpoints nuevos.
- Sin variables de entorno nuevas.
- Backwards-compatible: oficinas y mapas existentes sin `sprites_*` layers no se ven afectados.

## Riesgos

- **Tamaño de los assets**: cargar PNG+JSON por cada sprite del manifest, aunque el TMJ no use todos. Mitigación: `collectSpriteIds` solo carga los **referenciados** en el TMJ actual. El manifest tiene URLs pero no se descarga nada hasta que se referencie.
- **Conflictos de keys de animación**: si el `tag` del JSON Aseprite coincide con una animación built-in (p. ej. `walk` y existiera ya un `walk` global), `createFromAseprite` los crea con prefijo de textura key, así que no chocan. Pero conviene documentar la convención: las claves Aseprite son globales por scene; si dos sprites tienen un tag `walk`, Phaser usa el último creado para esa key. Mitigación: el manifest define `defaultTag` y los Points pueden sobrescribirlo, lo que reduce el problema en la práctica.
