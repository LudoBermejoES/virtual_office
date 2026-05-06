import { isObjectGroup, isTileLayer, type Tmj, type TmjTilesetEmbedded } from "./tmj.js";
import { maskGid, resolveGid } from "./gid.js";

/**
 * Extrae el conjunto de GIDs (sin bits de flip) realmente usados en el TMJ:
 *   - tilelayer.data
 *   - objectgroup tile-objects (con `gid`)
 */
export function extractUsedGids(tmj: Tmj): Set<number> {
  const used = new Set<number>();
  for (const layer of tmj.layers) {
    if (isTileLayer(layer)) {
      for (const raw of layer.data) {
        if (raw === 0) continue;
        used.add(maskGid(raw));
      }
      continue;
    }
    if (isObjectGroup(layer)) {
      for (const obj of layer.objects) {
        if (typeof obj.gid === "number" && obj.gid > 0) {
          used.add(maskGid(obj.gid));
        }
      }
    }
  }
  return used;
}

/**
 * Cierre transitivo: para cada GID usado cuyo tile tenga `animation`, añadir todos los
 * `tileid` destino al conjunto. Itera hasta punto fijo.
 */
export function applyAnimationClosure(
  used: Set<number>,
  tilesets: TmjTilesetEmbedded[],
): Set<number> {
  const closure = new Set(used);
  let changed = true;
  while (changed) {
    changed = false;
    for (const cleanGid of [...closure]) {
      const { tilesetIndex, localId } = resolveGid(cleanGid, tilesets);
      const ts = tilesets[tilesetIndex]!;
      const tile = ts.tiles?.find((t) => t.id === localId);
      if (!tile?.animation) continue;
      for (const frame of tile.animation) {
        if (frame.tileid < 0 || frame.tileid >= ts.tilecount) {
          throw new Error(`animation_target_out_of_tileset: tileset ${ts.name} → ${frame.tileid}`);
        }
        const targetGid = ts.firstgid + frame.tileid;
        if (!closure.has(targetGid)) {
          closure.add(targetGid);
          changed = true;
        }
      }
    }
  }
  return closure;
}
