import { describe, it, expect } from "vitest";
import { buildTsxXml } from "../../src/tsx.js";
import { computeLayout } from "../../src/layout.js";
import type { Strip } from "../../src/strips.js";

function strip(filename: string, frameCount: number, tile = 48): Strip {
  return {
    filename,
    fullPath: `/tmp/${filename}`,
    width: frameCount * tile,
    frameCount,
    sourceRow: 0,
  };
}

describe("buildTsxXml", () => {
  it("contiene el elemento tileset con dimensiones correctas", () => {
    const layout = computeLayout([strip("a.png", 3), strip("b.png", 2)], 48);
    const xml = buildTsxXml(layout, {
      imageFilename: "out.png",
      duration: 200,
      tilesetName: "out",
    });
    expect(xml).toMatch(/<tileset[^>]+tilewidth="48"/);
    expect(xml).toMatch(/<tileset[^>]+tileheight="48"/);
    expect(xml).toMatch(/<tileset[^>]+columns="3"/);
    expect(xml).toMatch(/<tileset[^>]+tilecount="6"/);
    expect(xml).toMatch(/<image source="out\.png" width="144" height="96"\/>/);
  });

  it("strip con frameCount > 1 genera animation con N frames", () => {
    const layout = computeLayout([strip("chair.png", 3)], 48);
    const xml = buildTsxXml(layout, {
      imageFilename: "out.png",
      duration: 200,
      tilesetName: "out",
    });
    expect(xml).toMatch(/<animation>/);
    expect(xml).toMatch(/<frame tileid="0" duration="200"\/>/);
    expect(xml).toMatch(/<frame tileid="1" duration="200"\/>/);
    expect(xml).toMatch(/<frame tileid="2" duration="200"\/>/);
  });

  it("strip con frameCount === 1 NO genera animation", () => {
    const layout = computeLayout([strip("static.png", 1)], 48);
    const xml = buildTsxXml(layout, {
      imageFilename: "out.png",
      duration: 200,
      tilesetName: "out",
    });
    expect(xml).not.toMatch(/<animation>/);
    expect(xml).toMatch(/<property name="name" value="static"\/>/);
  });

  it("primer tile de cada strip lleva property name con basename sin extensión", () => {
    const layout = computeLayout([strip("chair_swivel.png", 3), strip("lamp.png", 2)], 48);
    const xml = buildTsxXml(layout, {
      imageFilename: "out.png",
      duration: 200,
      tilesetName: "out",
    });
    expect(xml).toMatch(/<property name="name" value="chair_swivel"\/>/);
    expect(xml).toMatch(/<property name="name" value="lamp"\/>/);
  });

  it("escapa caracteres especiales en el filename", () => {
    const layout = computeLayout([strip("evil&name<.png", 2)], 48);
    const xml = buildTsxXml(layout, {
      imageFilename: "out.png",
      duration: 200,
      tilesetName: "out",
    });
    expect(xml).toMatch(/value="evil&amp;name&lt;"/);
  });

  it("usa el duration configurado", () => {
    const layout = computeLayout([strip("a.png", 2)], 48);
    const xml = buildTsxXml(layout, {
      imageFilename: "out.png",
      duration: 100,
      tilesetName: "out",
    });
    expect(xml).toMatch(/duration="100"/);
  });
});
