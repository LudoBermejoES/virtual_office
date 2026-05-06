import { describe, it, expect } from "vitest";
import { maskGid, flipBitsOf, combine, resolveGid, FLIP_BITS } from "../../src/gid.js";
import type { TmjTilesetEmbedded } from "../../src/tmj.js";

const FLIP_H = 0x80000000 >>> 0;
const FLIP_V = 0x40000000 >>> 0;
const FLIP_D = 0x20000000 >>> 0;

describe("gid bits", () => {
  it("maskGid quita los bits de flip", () => {
    expect(maskGid((42 | FLIP_H) >>> 0)).toBe(42);
    expect(maskGid((42 | FLIP_H | FLIP_V | FLIP_D) >>> 0)).toBe(42);
  });

  it("flipBitsOf extrae solo los bits de flip", () => {
    expect(flipBitsOf((42 | FLIP_H) >>> 0)).toBe(FLIP_H);
    expect(flipBitsOf(42)).toBe(0);
  });

  it("combine recompone preservando flips", () => {
    const original = (42 | FLIP_H | FLIP_V) >>> 0;
    const f = flipBitsOf(original);
    expect(combine(7, f)).toBe((7 | FLIP_H | FLIP_V) >>> 0);
  });

  it("FLIP_BITS = 0xE0000000", () => {
    expect(FLIP_BITS).toBe(0xe0000000 >>> 0);
  });
});

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

describe("resolveGid", () => {
  it("encuentra el tileset y localId correcto con un solo tileset", () => {
    const tilesets = [ts(1, 4)];
    expect(resolveGid(1, tilesets)).toEqual({ tilesetIndex: 0, localId: 0 });
    expect(resolveGid(4, tilesets)).toEqual({ tilesetIndex: 0, localId: 3 });
  });

  it("encuentra el tileset correcto con varios", () => {
    const tilesets = [ts(1, 4, "a"), ts(5, 4, "b")];
    expect(resolveGid(1, tilesets)).toEqual({ tilesetIndex: 0, localId: 0 });
    expect(resolveGid(4, tilesets)).toEqual({ tilesetIndex: 0, localId: 3 });
    expect(resolveGid(5, tilesets)).toEqual({ tilesetIndex: 1, localId: 0 });
    expect(resolveGid(8, tilesets)).toEqual({ tilesetIndex: 1, localId: 3 });
  });

  it("lanza con GID 0", () => {
    expect(() => resolveGid(0, [ts(1, 4)])).toThrow(/cannot_resolve_gid_zero/);
  });

  it("lanza con GID fuera de rango (mayor que cualquier tileset)", () => {
    expect(() => resolveGid(99, [ts(1, 4)])).toThrow(/corrupt_gid/);
  });
});
