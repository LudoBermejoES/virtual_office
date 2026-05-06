import { describe, it, expect } from "vitest";
import { parseTmj } from "../../src/tmj.js";

function baseTmj(overrides: Record<string, unknown> = {}) {
  return {
    type: "map",
    orientation: "orthogonal",
    width: 4,
    height: 4,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    tilesets: [
      {
        firstgid: 1,
        name: "ts",
        image: "ts.png",
        imagewidth: 64,
        imageheight: 64,
        tilewidth: 32,
        tileheight: 32,
        tilecount: 4,
        columns: 2,
      },
    ],
    layers: [
      {
        type: "tilelayer",
        name: "L",
        width: 4,
        height: 4,
        data: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
    ...overrides,
  };
}

describe("parseTmj", () => {
  it("acepta TMJ ortogonal embebido válido", () => {
    const tmj = parseTmj(baseTmj());
    expect(tmj.orientation).toBe("orthogonal");
    expect(tmj.tilesets).toHaveLength(1);
  });

  it("rechaza infinite=true", () => {
    expect(() => parseTmj(baseTmj({ infinite: true }))).toThrow(/infinite_not_supported/);
  });

  it("rechaza tilesets externos", () => {
    expect(() =>
      parseTmj(baseTmj({ tilesets: [{ firstgid: 1, source: "external.tsx" }] })),
    ).toThrow(/external_tileset_not_supported/);
  });

  it("rechaza orientation distinta de orthogonal", () => {
    expect(() => parseTmj(baseTmj({ orientation: "isometric" }))).toThrow(/only_orthogonal/);
  });

  it("rechaza JSON inválido (sin type=map)", () => {
    expect(() => parseTmj({ foo: "bar" })).toThrow(/invalid_tmj/);
  });
});
