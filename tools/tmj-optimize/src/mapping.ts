import { resolveGid } from "./gid.js";
import type { TmjTilesetEmbedded } from "./tmj.js";

export interface MappingEntry {
  oldGid: number;
  sourceTilesetIndex: number;
  sourceLocalId: number;
  newLocalId: number;
}

export interface GidMapping {
  oldToNewLocal: Map<number, number>;
  ordered: MappingEntry[];
}

/**
 * Construye el mapeo `oldGid → newLocalId` ordenando por (tilesetIndex, localId) ASC.
 * Determinista: el mismo input produce siempre el mismo output.
 */
export function buildGidMapping(usedGids: Set<number>, tilesets: TmjTilesetEmbedded[]): GidMapping {
  const entries: Omit<MappingEntry, "newLocalId">[] = [];
  for (const oldGid of usedGids) {
    const { tilesetIndex, localId } = resolveGid(oldGid, tilesets);
    entries.push({ oldGid, sourceTilesetIndex: tilesetIndex, sourceLocalId: localId });
  }
  entries.sort((a, b) => {
    if (a.sourceTilesetIndex !== b.sourceTilesetIndex) {
      return a.sourceTilesetIndex - b.sourceTilesetIndex;
    }
    return a.sourceLocalId - b.sourceLocalId;
  });

  const ordered: MappingEntry[] = entries.map((e, i) => ({ ...e, newLocalId: i }));
  const oldToNewLocal = new Map(ordered.map((e) => [e.oldGid, e.newLocalId]));
  return { oldToNewLocal, ordered };
}
