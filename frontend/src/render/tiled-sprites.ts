/**
 * Procesa object layers `sprites_*` del TMJ y renderiza Aseprite sprites en
 * Phaser respetando el `depth` correspondiente al índice del object layer en
 * `tmj.layers[]`.
 */
import type * as Phaser from "phaser";
import type { SpriteManifest } from "./sprite-manifest.js";

export interface SpritePlacement {
  id: string;
  tag?: string;
  x: number;
  y: number;
  depth: number;
  layerName: string;
}

interface TiledLayer {
  type?: string;
  name?: string;
  objects?: TiledObject[];
}

interface TiledObject {
  point?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  type?: string;
  properties?: Array<{ name: string; value: unknown; type?: string }>;
}

interface TiledMapLike {
  layers?: TiledLayer[];
}

const SPRITES_LAYER_PREFIX = "sprites_";

interface AsepriteJsonMeta {
  meta?: { frameTags?: Array<{ name: string }> };
}

function readFirstAsepriteTag(scene: Phaser.Scene, key: string): string | undefined {
  // scene.load.aseprite cachea el JSON con la misma key bajo cache.json.
  const json = scene.cache.json.get(key) as AsepriteJsonMeta | undefined;
  return json?.meta?.frameTags?.[0]?.name;
}

function isSpritesLayer(layer: TiledLayer): boolean {
  return (
    layer.type === "objectgroup" &&
    typeof layer.name === "string" &&
    layer.name.startsWith(SPRITES_LAYER_PREFIX)
  );
}

function readStringProperty(obj: TiledObject, name: string): string | undefined {
  const prop = obj.properties?.find((p) => p.name === name);
  if (!prop) return undefined;
  if (typeof prop.value !== "string") return undefined;
  return prop.value;
}

/**
 * Devuelve la lista de ids únicos referenciados por algún Point con property
 * `sprite` en cualquier object layer `sprites_*`. Sin duplicados.
 */
export function collectSpriteIds(tmj: TiledMapLike): string[] {
  const ids = new Set<string>();
  const layers = tmj.layers ?? [];
  for (const layer of layers) {
    if (!isSpritesLayer(layer)) continue;
    for (const obj of layer.objects ?? []) {
      if (!obj.point) continue;
      const id = readStringProperty(obj, "sprite");
      if (!id) continue;
      ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Devuelve un array con un placement por cada Point válido. El `depth` viene
 * del índice del object layer en `tmj.layers[]`.
 *
 * Ignora con `console.warn`:
 *  - Objects que no son Points (rectángulos, text, etc.).
 *  - Points sin property `sprite`.
 */
export function enumerateSpritePlacements(tmj: TiledMapLike): SpritePlacement[] {
  const placements: SpritePlacement[] = [];
  const layers = tmj.layers ?? [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]!;
    if (!isSpritesLayer(layer)) continue;
    const layerName = layer.name ?? "";
    for (const obj of layer.objects ?? []) {
      if (!obj.point) {
        if (obj.width || obj.height) {
          console.warn(
            `[tiled-sprites] object en layer "${layerName}" no es Point (tiene width/height); ignorado`,
          );
        }
        continue;
      }
      const id = readStringProperty(obj, "sprite");
      if (!id) {
        console.warn(
          `[tiled-sprites] Point en layer "${layerName}" sin property 'sprite'; ignorado`,
        );
        continue;
      }
      const tag = readStringProperty(obj, "tag");
      placements.push({
        id,
        ...(tag !== undefined ? { tag } : {}),
        x: obj.x ?? 0,
        y: obj.y ?? 0,
        depth: i,
        layerName,
      });
    }
  }
  return placements;
}

/**
 * Carga (vía `scene.load.aseprite`) los sprites referenciados en el TMJ que
 * todavía no estén en `scene.textures`. Solo carga los que tengan entrada en
 * el manifest; los demás se ignoran con warn.
 *
 * Llamar durante `preload()` o tras parsear el TMJ; si la fase de loader ya
 * está cerrada, llama internamente a `scene.load.start()`.
 */
export function preloadTiledSprites(
  scene: Phaser.Scene,
  tmj: TiledMapLike,
  manifest: SpriteManifest,
): void {
  const ids = collectSpriteIds(tmj);
  let queuedAny = false;
  for (const id of ids) {
    const entry = manifest[id];
    if (!entry) {
      console.warn(`[tiled-sprites] sprite "${id}" no está en el manifest; ignorado`);
      continue;
    }
    if (scene.textures.exists(id)) continue;
    scene.load.aseprite(id, entry.png, entry.json);
    queuedAny = true;
  }
  if (queuedAny && !scene.load.isLoading()) {
    scene.load.start();
  }
}

/**
 * Crea los sprites declarados en `sprites_*` y devuelve la lista para limpieza
 * posterior. Antes de llamar, los assets del manifest deben estar cargados
 * (haberse hecho `preloadTiledSprites` y esperado a `complete`).
 */
export function renderTiledSprites(
  scene: Phaser.Scene,
  tmj: TiledMapLike,
  manifest: SpriteManifest,
): Phaser.GameObjects.Sprite[] {
  const created: Phaser.GameObjects.Sprite[] = [];
  const placements = enumerateSpritePlacements(tmj);

  for (const p of placements) {
    if (!manifest[p.id]) {
      console.warn(
        `[tiled-sprites] sprite "${p.id}" no está en el manifest al renderizar; ignorado`,
      );
      continue;
    }
    if (!scene.textures.exists(p.id)) {
      console.warn(`[tiled-sprites] textura "${p.id}" no cargada; ignorando placement`);
      continue;
    }
    // createFromAseprite es idempotente (ignora keys ya existentes).
    scene.anims.createFromAseprite(p.id);

    const sprite = scene.add.sprite(p.x, p.y, p.id);
    sprite.setDepth(p.depth);

    const tag = p.tag ?? manifest[p.id]?.defaultTag;
    if (tag) {
      sprite.play({ key: tag, repeat: -1 });
    } else {
      // Sin tag: leer el primer frameTag del JSON Aseprite cacheado por scene.load.aseprite.
      const firstTag = readFirstAsepriteTag(scene, p.id);
      if (firstTag) sprite.play({ key: firstTag, repeat: -1 });
    }

    created.push(sprite);
  }

  return created;
}
