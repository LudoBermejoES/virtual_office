import { describe, it, expect } from "vitest";
import { buildGidMapping } from "../../src/mapping.js";
import type { TmjTilesetEmbedded } from "../../src/tmj.js";

function ts(firstgid: number, tilecount: number, name = "ts"): TmjTilesetEmbedded {
  return {
    firstgid,
    name,
    image: `${name}.png`,
    imagewidth: 32,
    imageheight: 32,
    tilewidth: 16,
    tileheight: 16,
    tilecount,
    columns: 2,
    margin: 0,
    spacing: 0,
  } as TmjTilesetEmbedded;
}

describe("buildGidMapping", () => {
  it("ordena por (tilesetIndex, localId) ASC y asigna newLocalId 0..N-1", () => {
    const tilesets = [ts(1, 4, "a"), ts(5, 4, "b")];
    const used = new Set([3, 1, 6, 5]); // mezclados a propósito
    const m = buildGidMapping(used, tilesets);
    expect(m.ordered.map((e) => ({ old: e.oldGid, new: e.newLocalId }))).toEqual([
      { old: 1, new: 0 },
      { old: 3, new: 1 },
      { old: 5, new: 2 },
      { old: 6, new: 3 },
    ]);
  });

  it("oldToNewLocal coincide con ordered", () => {
    const tilesets = [ts(1, 4)];
    const used = new Set([4, 2]);
    const m = buildGidMapping(used, tilesets);
    expect(m.oldToNewLocal.get(2)).toBe(0);
    expect(m.oldToNewLocal.get(4)).toBe(1);
  });

  it("es reproducible (mismo input → mismo output)", () => {
    const tilesets = [ts(1, 4)];
    const used = new Set([4, 1, 3]);
    const a = buildGidMapping(used, tilesets);
    const b = buildGidMapping(used, tilesets);
    expect(a.ordered).toEqual(b.ordered);
  });
});
