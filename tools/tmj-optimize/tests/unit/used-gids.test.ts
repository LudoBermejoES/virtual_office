import { describe, it, expect } from "vitest";
import { extractUsedGids, applyAnimationClosure } from "../../src/used-gids.js";
import type { Tmj, TmjTilesetEmbedded } from "../../src/tmj.js";

const FLIP_H = 0x80000000 >>> 0;

function makeTmj(layers: Tmj["layers"], tilesets: Tmj["tilesets"] = []): Tmj {
  return {
    type: "map",
    orientation: "orthogonal",
    width: 4,
    height: 4,
    tilewidth: 16,
    tileheight: 16,
    infinite: false,
    tilesets,
    layers,
  } as Tmj;
}

describe("extractUsedGids", () => {
  it("acumula GIDs de tilelayer y objectgroup tile-objects", () => {
    const tmj = makeTmj([
      {
        type: "tilelayer",
        name: "L",
        width: 2,
        height: 2,
        data: [1, 2, 0, 3],
      } as never,
      {
        type: "objectgroup",
        name: "obj",
        objects: [
          { id: 1, x: 0, y: 0, gid: 5 },
          { id: 2, x: 0, y: 0 }, // sin gid: no aporta
        ],
      } as never,
    ]);
    const used = extractUsedGids(tmj);
    expect([...used].sort((a, b) => a - b)).toEqual([1, 2, 3, 5]);
  });

  it("enmascara los bits de flip", () => {
    const tmj = makeTmj([
      {
        type: "tilelayer",
        name: "L",
        width: 1,
        height: 1,
        data: [(42 | FLIP_H) >>> 0],
      } as never,
    ]);
    expect([...extractUsedGids(tmj)]).toEqual([42]);
  });

  it("ignora object layers sin tile-objects", () => {
    const tmj = makeTmj([
      {
        type: "objectgroup",
        name: "zones",
        objects: [{ id: 1, x: 0, y: 0, width: 50, height: 50 }],
      } as never,
    ]);
    expect(extractUsedGids(tmj).size).toBe(0);
  });
});

function ts(
  firstgid: number,
  tilecount: number,
  tiles?: TmjTilesetEmbedded["tiles"],
): TmjTilesetEmbedded {
  return {
    firstgid,
    name: `t${firstgid}`,
    image: "x.png",
    imagewidth: 32,
    imageheight: 32,
    tilewidth: 16,
    tileheight: 16,
    tilecount,
    columns: 2,
    margin: 0,
    spacing: 0,
    tiles,
  } as TmjTilesetEmbedded;
}

describe("applyAnimationClosure", () => {
  it("añade tiles destino de animaciones", () => {
    const tilesets = [
      ts(1, 4, [{ id: 0, animation: [{ tileid: 0, duration: 100 }, { tileid: 1, duration: 100 }] }]),
    ];
    const used = new Set([1]); // tile firstgid=1, local=0, anima a local=1 → gid 2
    const closure = applyAnimationClosure(used, tilesets);
    expect([...closure].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("transitivo A→B, B→C", () => {
    const tilesets = [
      ts(1, 4, [
        { id: 0, animation: [{ tileid: 1, duration: 100 }] }, // gid 1 → gid 2
        { id: 1, animation: [{ tileid: 2, duration: 100 }] }, // gid 2 → gid 3
      ]),
    ];
    const used = new Set([1]);
    const closure = applyAnimationClosure(used, tilesets);
    expect([...closure].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("rechaza animación con destino fuera del tileset", () => {
    const tilesets = [
      ts(1, 4, [{ id: 0, animation: [{ tileid: 99, duration: 100 }] }]),
    ];
    expect(() => applyAnimationClosure(new Set([1]), tilesets)).toThrow(
      /animation_target_out_of_tileset/,
    );
  });
});
