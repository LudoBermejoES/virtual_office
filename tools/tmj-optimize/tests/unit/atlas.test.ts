import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { composeAtlas } from "../../src/atlas.js";
import { buildGidMapping } from "../../src/mapping.js";
import type { TmjTilesetEmbedded } from "../../src/tmj.js";

async function makeTilesetBuffer(cols: number, rows: number, tile: number): Promise<Buffer> {
  // Crea un PNG con bandas de colores diferentes por tile (para verificar)
  const w = cols * tile;
  const h = rows * tile;
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function ts(firstgid: number, cols: number, rows: number, tile: number): TmjTilesetEmbedded {
  return {
    firstgid,
    name: "ts",
    image: "ts.png",
    imagewidth: cols * tile,
    imageheight: rows * tile,
    tilewidth: tile,
    tileheight: tile,
    tilecount: cols * rows,
    columns: cols,
    margin: 0,
    spacing: 0,
  } as TmjTilesetEmbedded;
}

describe("composeAtlas", () => {
  it("compone un atlas con dimensiones esperadas para 3 tiles", async () => {
    const tile = 16;
    const tilesets = [ts(1, 4, 4, tile)];
    const buffers = [await makeTilesetBuffer(4, 4, tile)];
    const mapping = buildGidMapping(new Set([1, 5, 10]), tilesets);

    const atlas = await composeAtlas(tilesets, buffers, mapping, tile, tile);
    // 3 tiles → cols=2, rows=2, width=32, height=32
    expect(atlas.cols).toBe(2);
    expect(atlas.rows).toBe(2);
    expect(atlas.width).toBe(32);
    expect(atlas.height).toBe(32);

    const meta = await sharp(atlas.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });

  it("padding > 0 aumenta el tamaño del atlas", async () => {
    const tile = 16;
    const tilesets = [ts(1, 2, 2, tile)];
    const buffers = [await makeTilesetBuffer(2, 2, tile)];
    const mapping = buildGidMapping(new Set([1, 2, 3, 4]), tilesets);

    const atlas = await composeAtlas(tilesets, buffers, mapping, tile, tile, { padding: 2 });
    // 4 tiles → cols=2, rows=2: 2*16 + 1*2 = 34
    expect(atlas.width).toBe(34);
    expect(atlas.height).toBe(34);
  });

  it("rechaza si no hay tiles", async () => {
    const mapping = buildGidMapping(new Set(), []);
    await expect(composeAtlas([], [], mapping, 16, 16)).rejects.toThrow(/no_tiles/);
  });
});
