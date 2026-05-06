import { describe, it, expect } from "vitest";
import { buildOutputTmj } from "../../src/output-tmj.js";
import { buildGidMapping } from "../../src/mapping.js";
import { extractUsedGids } from "../../src/used-gids.js";
import type { Tmj, TmjTilesetEmbedded } from "../../src/tmj.js";

const FLIP_H = 0x80000000 >>> 0;

function ts(
  firstgid: number,
  tilecount: number,
  name = "ts",
  tiles?: TmjTilesetEmbedded["tiles"],
): TmjTilesetEmbedded {
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
    tiles,
  } as TmjTilesetEmbedded;
}

function makeTmj(layers: Tmj["layers"], tilesets: TmjTilesetEmbedded[]): Tmj {
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

const ATLAS = { buffer: Buffer.alloc(0), cols: 2, rows: 2, width: 32, height: 32 };

describe("buildOutputTmj", () => {
  it("reemplaza tilesets por uno solo con firstgid=1 y dimensiones correctas", () => {
    const tilesets = [ts(1, 4, "a")];
    const tmj = makeTmj(
      [
        {
          type: "tilelayer",
          name: "L",
          width: 2,
          height: 2,
          data: [1, 2, 3, 4],
        } as never,
      ],
      tilesets,
    );
    const used = extractUsedGids(tmj);
    const mapping = buildGidMapping(used, tilesets);

    const out = buildOutputTmj({
      input: tmj,
      inputTilesets: tilesets,
      mapping,
      atlas: ATLAS,
      outputImageName: "out.webp",
      padding: 0,
    });

    expect(out.tilesets).toHaveLength(1);
    expect(out.tilesets[0]).toMatchObject({
      firstgid: 1,
      image: "out.webp",
      tilecount: 4,
      columns: 2,
      imagewidth: 32,
      imageheight: 32,
    });
  });

  it("data[] queda remapeado preservando flip bits", () => {
    const tilesets = [ts(1, 4)];
    const tmj = makeTmj(
      [
        {
          type: "tilelayer",
          name: "L",
          width: 1,
          height: 2,
          data: [1, (3 | FLIP_H) >>> 0],
        } as never,
      ],
      tilesets,
    );
    const used = extractUsedGids(tmj);
    const mapping = buildGidMapping(used, tilesets);
    const out = buildOutputTmj({
      input: tmj,
      inputTilesets: tilesets,
      mapping,
      atlas: ATLAS,
      outputImageName: "out.webp",
      padding: 0,
    });
    const dataOut = (out.layers[0] as { data: number[] }).data;
    expect(dataOut[0]).toBe(1); // gid 1 → newLocal 0 → +1
    expect(dataOut[1]).toBe((2 | FLIP_H) >>> 0); // gid 3 → newLocal 1 → +1, con FLIP_H
  });

  it("object layers de rectángulos se copian tal cual", () => {
    const tilesets = [ts(1, 4)];
    const tmj = makeTmj(
      [
        {
          type: "tilelayer",
          name: "L",
          width: 1,
          height: 1,
          data: [1],
        } as never,
        {
          type: "objectgroup",
          name: "zones",
          objects: [{ id: 1, x: 10, y: 20, width: 50, height: 50 }],
        } as never,
      ],
      tilesets,
    );
    const used = extractUsedGids(tmj);
    const mapping = buildGidMapping(used, tilesets);
    const out = buildOutputTmj({
      input: tmj,
      inputTilesets: tilesets,
      mapping,
      atlas: ATLAS,
      outputImageName: "out.webp",
      padding: 0,
    });
    const objLayer = out.layers[1] as { objects: { x: number; width: number }[] };
    expect(objLayer.objects[0]).toMatchObject({ x: 10, width: 50 });
  });

  it("object layers tile-objects con gid se remapean", () => {
    const tilesets = [ts(1, 4)];
    const tmj = makeTmj(
      [
        {
          type: "tilelayer",
          name: "L",
          width: 1,
          height: 1,
          data: [3],
        } as never,
        {
          type: "objectgroup",
          name: "obj",
          objects: [{ id: 1, x: 0, y: 0, gid: 3 }],
        } as never,
      ],
      tilesets,
    );
    const used = extractUsedGids(tmj);
    const mapping = buildGidMapping(used, tilesets);
    const out = buildOutputTmj({
      input: tmj,
      inputTilesets: tilesets,
      mapping,
      atlas: ATLAS,
      outputImageName: "out.webp",
      padding: 0,
    });
    const objLayer = out.layers[1] as { objects: { gid: number }[] };
    expect(objLayer.objects[0]!.gid).toBe(1); // gid 3 → newLocal 0 → +1
  });

  it("migra animaciones y properties a los nuevos localId", () => {
    const tilesets = [
      ts(1, 4, "a", [
        {
          id: 0,
          properties: [{ name: "wall", type: "bool", value: true } as never],
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 1, duration: 100 },
          ],
        },
      ]),
    ];
    const tmj = makeTmj(
      [
        {
          type: "tilelayer",
          name: "L",
          width: 1,
          height: 1,
          data: [1],
        } as never,
      ],
      tilesets,
    );
    // El cierre debería añadir gid=2 al set, simulamos pasando ambos directamente
    const used = new Set([1, 2]);
    const mapping = buildGidMapping(used, tilesets);
    const out = buildOutputTmj({
      input: tmj,
      inputTilesets: tilesets,
      mapping,
      atlas: ATLAS,
      outputImageName: "out.webp",
      padding: 0,
    });
    const tiles = out.tilesets[0]!.tiles!;
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.id).toBe(0); // newLocal del gid 1
    expect(tiles[0]!.animation).toEqual([
      { tileid: 0, duration: 100 },
      { tileid: 1, duration: 100 },
    ]);
    expect(tiles[0]!.properties).toBeDefined();
  });
});
