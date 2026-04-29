import { describe, it, expect } from "vitest";
import { parseTiled, checkTilesetMatch } from "../../../src/domain/tiled.js";

function baseMap(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    width: 20,
    height: 15,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    tilesets: [
      {
        firstgid: 1,
        name: "office_tiles",
        image: "office_tiles.png",
        imagewidth: 256,
        imageheight: 256,
        tilewidth: 32,
        tileheight: 32,
      },
    ],
    layers: [
      {
        type: "tilelayer",
        name: "ground",
        width: 20,
        height: 15,
        data: [0, 1, 2],
        encoding: "csv",
      },
    ],
    ...overrides,
  };
}

describe("TiledMapSchema vía parseTiled", () => {
  it("acepta un .tmj mínimo válido", () => {
    const r = parseTiled(JSON.stringify(baseMap()));
    expect(r.ok).toBe(true);
  });

  it("rechaza JSON malformado con invalid_tmj", () => {
    const r = parseTiled("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_tmj");
  });

  it("rechaza version: 1.9 con tiled_version_unsupported", () => {
    const r = parseTiled(JSON.stringify(baseMap({ version: "1.9" })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("tiled_version_unsupported");
  });

  it("rechaza orientation: isometric", () => {
    const r = parseTiled(JSON.stringify(baseMap({ orientation: "isometric" })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("orientation_unsupported");
  });

  it("rechaza tile layer con compression: zlib", () => {
    const r = parseTiled(
      JSON.stringify(
        baseMap({
          layers: [
            {
              type: "tilelayer",
              name: "ground",
              width: 20,
              height: 15,
              data: "abc",
              encoding: "base64",
              compression: "zlib",
            },
          ],
        }),
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("compression_unsupported");
  });

  it("rechaza tileset con source externo", () => {
    const r = parseTiled(
      JSON.stringify(
        baseMap({
          tilesets: [
            {
              firstgid: 1,
              name: "ext",
              source: "tiles.tsj",
              image: "office_tiles.png",
              imagewidth: 256,
              imageheight: 256,
              tilewidth: 32,
              tileheight: 32,
            },
          ],
        }),
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("external_tilesets_unsupported");
  });

  it("rechaza tilewidth fuera de rango (4)", () => {
    const r = parseTiled(JSON.stringify(baseMap({ tilewidth: 4 })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_tmj");
  });

  it("rechaza dimensiones totales > 4096 px", () => {
    const r = parseTiled(JSON.stringify(baseMap({ width: 200, height: 200 })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("map_too_large");
  });

  it("rechaza image con path traversal", () => {
    const r = parseTiled(
      JSON.stringify(
        baseMap({
          tilesets: [
            {
              firstgid: 1,
              name: "x",
              image: "../foo.png",
              imagewidth: 256,
              imageheight: 256,
              tilewidth: 32,
              tileheight: 32,
            },
          ],
        }),
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_tmj");
  });
});

describe("checkTilesetMatch", () => {
  it("ok cuando 1:1", () => {
    const r = checkTilesetMatch({ tilesets: [{ image: "a.png" }] }, ["a.png"]);
    expect(r.ok).toBe(true);
  });

  it("falla con missing si falta un PNG referenciado", () => {
    const r = checkTilesetMatch(
      { tilesets: [{ image: "a.png" }, { image: "b.png" }] },
      ["a.png"],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("tileset_mismatch");
      expect(r.details.some((d) => d.includes("missing: b.png"))).toBe(true);
    }
  });

  it("falla con extra si sobra un PNG no referenciado", () => {
    const r = checkTilesetMatch({ tilesets: [{ image: "a.png" }] }, ["a.png", "extra.png"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.details.some((d) => d.includes("extra: extra.png"))).toBe(true);
  });
});
