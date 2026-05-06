import { combine, flipBitsOf, maskGid, resolveGid } from "./gid.js";
import type { GidMapping } from "./mapping.js";
import {
  isObjectGroup,
  isTileLayer,
  type Tmj,
  type TmjTilesetEmbedded,
  type TmjTilesetTile,
} from "./tmj.js";
import type { AtlasResult } from "./atlas.js";

export interface BuildOutputArgs {
  input: Tmj;
  inputTilesets: TmjTilesetEmbedded[];
  mapping: GidMapping;
  atlas: AtlasResult;
  outputImageName: string;
  padding: number;
}

/**
 * Construye el TMJ optimizado con un único tileset que apunta al atlas.
 */
export function buildOutputTmj(args: BuildOutputArgs): Tmj {
  const { input, inputTilesets, mapping, atlas, outputImageName, padding } = args;

  const newTilesetTiles = migrateTiles(inputTilesets, mapping);

  const newTileset: TmjTilesetEmbedded = {
    firstgid: 1,
    // El frontend de Virtual Office usa el basename del fichero (sin extensión) como
    // identificador del tileset al hacer addTilesetImage. Mantener esa convención.
    name: outputImageName.replace(/\.[^.]+$/, ""),
    image: outputImageName,
    imagewidth: atlas.width,
    imageheight: atlas.height,
    tilewidth: input.tilewidth,
    tileheight: input.tileheight,
    tilecount: mapping.ordered.length,
    columns: atlas.cols,
    margin: 0,
    spacing: padding,
    ...(newTilesetTiles.length > 0 ? { tiles: newTilesetTiles } : {}),
  };

  const remap = (rawGid: number): number => {
    if (rawGid === 0) return 0;
    const flips = flipBitsOf(rawGid);
    const clean = maskGid(rawGid);
    const newLocal = mapping.oldToNewLocal.get(clean);
    if (newLocal === undefined) {
      throw new Error(`unmapped_gid: ${clean}`);
    }
    return combine(1 + newLocal, flips);
  };

  const newLayers = input.layers.map((layer) => {
    if (isTileLayer(layer)) {
      return { ...layer, data: layer.data.map(remap) };
    }
    if (isObjectGroup(layer)) {
      const newObjects = layer.objects.map((obj) => {
        if (typeof obj.gid === "number" && obj.gid > 0) {
          return { ...obj, gid: remap(obj.gid) };
        }
        return obj;
      });
      return { ...layer, objects: newObjects };
    }
    return layer;
  });

  return {
    ...input,
    tilesets: [newTileset],
    layers: newLayers,
  };
}

function migrateTiles(inputTilesets: TmjTilesetEmbedded[], mapping: GidMapping): TmjTilesetTile[] {
  const out: TmjTilesetTile[] = [];
  for (const entry of mapping.ordered) {
    const ts = inputTilesets[entry.sourceTilesetIndex]!;
    const tile = ts.tiles?.find((t) => t.id === entry.sourceLocalId);
    if (!tile) continue;

    const migratedAnimation = tile.animation?.map((frame) => {
      const sourceGid = ts.firstgid + frame.tileid;
      const targetNewLocal = mapping.oldToNewLocal.get(sourceGid);
      if (targetNewLocal === undefined) {
        throw new Error(`animation_target_unmapped: tileset ${ts.name} → ${frame.tileid}`);
      }
      return { tileid: targetNewLocal, duration: frame.duration };
    });

    const newTile: TmjTilesetTile = {
      id: entry.newLocalId,
      ...(tile.properties ? { properties: tile.properties } : {}),
      ...(tile.type ? { type: tile.type } : {}),
      ...(migratedAnimation ? { animation: migratedAnimation } : {}),
    };
    out.push(newTile);
  }
  return out;
}

/** Util para dropear bits de flip durante validaciones de tests. */
export function unflag(gid: number): { local: number; flips: number } {
  return { local: maskGid(gid), flips: flipBitsOf(gid) };
}

/** Re-export por conveniencia. */
export { resolveGid };
