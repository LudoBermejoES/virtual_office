import { describe, it, expect } from "vitest";
import { buildImageCollectionTsx } from "../../src/collection-tsx.js";
import type { CollectionTile } from "../../src/collection-tsx.js";
import { effectiveFrameSize, pngInfoFromPath } from "../../src/mode-detection.js";

function makeTile(filename: string, w: number, h: number, row = 0): CollectionTile {
  const size = effectiveFrameSize(pngInfoFromPath(filename, w, h), {});
  return { size, rowIndex: row, imageRelPath: `out_assets/${filename}` };
}

describe("buildImageCollectionTsx", () => {
  it("declara columns=0 y elemento <grid> (Image Collection)", () => {
    const xml = buildImageCollectionTsx([makeTile("a.png", 96, 48)], {
      tilesetName: "out",
      duration: 200,
    });
    expect(xml).toMatch(/columns="0"/);
    expect(xml).toMatch(/<grid orientation="orthogonal"/);
  });

  it("incluye properties name, frame_width, frame_height, frame_count, row_index", () => {
    const xml = buildImageCollectionTsx([makeTile("cat.png", 1728, 48)], {
      tilesetName: "out",
      duration: 100,
    });
    expect(xml).toMatch(/<property name="name" value="cat"\/>/);
    expect(xml).toMatch(/<property name="frame_width" type="int" value="48"\/>/);
    expect(xml).toMatch(/<property name="frame_height" type="int" value="48"\/>/);
    expect(xml).toMatch(/<property name="frame_count" type="int" value="36"\/>/);
    expect(xml).toMatch(/<property name="row_index" type="int" value="0"\/>/);
    expect(xml).toMatch(/<property name="duration_ms" type="int" value="100"\/>/);
  });

  it("<image source> apunta a la subcarpeta _assets", () => {
    const xml = buildImageCollectionTsx([makeTile("cat.png", 1728, 48)], {
      tilesetName: "out",
      duration: 100,
    });
    expect(xml).toMatch(/<image source="out_assets\/cat\.png" width="1728" height="48"\/>/);
  });

  it("multi-row genera nombres __row0, __row1", () => {
    const tiles: CollectionTile[] = [
      makeTile("grid.png", 144, 96, 0),
      makeTile("grid.png", 144, 96, 1),
    ];
    const xml = buildImageCollectionTsx(tiles, { tilesetName: "out", duration: 200 });
    expect(xml).toMatch(/<property name="name" value="grid__row0"\/>/);
    expect(xml).toMatch(/<property name="name" value="grid__row1"\/>/);
  });

  it("escapa XML en filenames", () => {
    const tile = makeTile("evil&name<.png", 96, 48);
    const xml = buildImageCollectionTsx([tile], { tilesetName: "out", duration: 200 });
    expect(xml).toMatch(/value="evil&amp;name&lt;"/);
  });
});
