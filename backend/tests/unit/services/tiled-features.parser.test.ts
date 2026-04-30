import { describe, it, expect } from "vitest";
import { parseTiledFeatures } from "../../../src/services/tiled-features.parser.js";

const MAP_W = 640; // 20 tiles * 32px
const MAP_H = 480; // 15 tiles * 32px

function baseTmj(overrides: Record<string, unknown> = {}) {
  return {
    width: 20,
    height: 15,
    tilewidth: 32,
    tileheight: 32,
    layers: [],
    ...overrides,
  };
}

function objectLayer(name: string, objects: unknown[]) {
  return { type: "objectgroup", name, objects };
}

// ── 2.1 Zonas rectangulares ───────────────────────────────────────────────────

describe("parseTiledFeatures — zonas rectangulares", () => {
  it("extrae una zona rectangular correctamente", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 1,
            name: "Cocina",
            x: 64,
            y: 96,
            width: 128,
            height: 64,
            properties: [{ name: "kind", type: "string", value: "kitchen" }],
          },
        ]),
      ],
    });

    const result = parseTiledFeatures(tmj);
    expect(result.zones).toHaveLength(1);
    expect(result.zones[0]).toMatchObject({
      name: "Cocina",
      kind: "kitchen",
      geometry: { type: "rect", x: 64, y: 96, w: 128, h: 64 },
    });
    expect(result.rooms).toHaveLength(0);
    expect(result.labels).toHaveLength(0);
  });
});

// ── 2.2 Polígonos con coordenadas relativas → absolutas ───────────────────────

describe("parseTiledFeatures — polígonos", () => {
  it("convierte coordenadas relativas a absolutas", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 2,
            name: "Sala mar",
            x: 100,
            y: 50,
            polygon: [
              { x: 0, y: 0 },
              { x: 64, y: 0 },
              { x: 64, y: 64 },
              { x: 0, y: 64 },
            ],
            properties: [{ name: "kind", type: "string", value: "meeting" }],
          },
        ]),
      ],
    });

    const result = parseTiledFeatures(tmj);
    expect(result.zones[0]?.geometry).toMatchObject({
      type: "polygon",
      points: [
        { x: 100, y: 50 },
        { x: 164, y: 50 },
        { x: 164, y: 114 },
        { x: 100, y: 114 },
      ],
    });
  });
});

// ── 2.3 Labels con font y size ────────────────────────────────────────────────

describe("parseTiledFeatures — labels", () => {
  it("extrae labels con font y size válidos", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("labels", [
          {
            id: 3,
            name: "Mar",
            x: 200,
            y: 100,
            point: true,
            properties: [
              { name: "font", type: "string", value: "display" },
              { name: "size", type: "int", value: 24 },
            ],
          },
        ]),
      ],
    });

    const result = parseTiledFeatures(tmj);
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0]).toMatchObject({
      name: "Mar",
      font: "display",
      size: 24,
      geometry: { type: "point", x: 200, y: 100 },
    });
  });
});

// ── 2.4 Name inválido ─────────────────────────────────────────────────────────

describe("parseTiledFeatures — validación de name", () => {
  it("rechaza features con nombre vacío", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 4,
            name: "",
            x: 10,
            y: 10,
            width: 50,
            height: 50,
            properties: [{ name: "kind", type: "string", value: "open" }],
          },
        ]),
      ],
    });
    expect(() => parseTiledFeatures(tmj)).toThrow();
  });

  it("rechaza features con caracteres de control en el nombre", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 5,
            name: "Cocina\x00evil",
            x: 10,
            y: 10,
            width: 50,
            height: 50,
            properties: [{ name: "kind", type: "string", value: "open" }],
          },
        ]),
      ],
    });
    expect(() => parseTiledFeatures(tmj)).toThrow();
  });
});

// ── 2.5 Polígonos con < 3 o > 64 puntos ──────────────────────────────────────

describe("parseTiledFeatures — validación de polígonos", () => {
  it("rechaza polígonos con menos de 3 puntos", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 6,
            name: "Poca",
            x: 10,
            y: 10,
            polygon: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
            ],
            properties: [{ name: "kind", type: "string", value: "open" }],
          },
        ]),
      ],
    });
    expect(() => parseTiledFeatures(tmj)).toThrow();
  });

  it("rechaza polígonos con más de 64 puntos", () => {
    const tooManyPoints = Array.from({ length: 65 }, (_, i) => ({
      x: Math.cos((i / 65) * 2 * Math.PI) * 50,
      y: Math.sin((i / 65) * 2 * Math.PI) * 50,
    }));
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 7,
            name: "Muchos",
            x: 60,
            y: 60,
            polygon: tooManyPoints,
            properties: [{ name: "kind", type: "string", value: "open" }],
          },
        ]),
      ],
    });
    expect(() => parseTiledFeatures(tmj)).toThrow();
  });
});

// ── 2.6 Kind inválido ─────────────────────────────────────────────────────────

describe("parseTiledFeatures — kind inválido", () => {
  it("rechaza features con kind fuera del enum", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 8,
            name: "Baño",
            x: 10,
            y: 10,
            width: 50,
            height: 50,
            properties: [{ name: "kind", type: "string", value: "restroom" }],
          },
        ]),
      ],
    });
    expect(() => parseTiledFeatures(tmj)).toThrow(/invalid_feature_kind/);
  });
});

// ── 2.7 Geometría fuera del mapa ──────────────────────────────────────────────

describe("parseTiledFeatures — fuera de bounds", () => {
  it("rechaza features con geometría fuera del mapa", () => {
    const tmj = baseTmj({
      layers: [
        objectLayer("zones", [
          {
            id: 9,
            name: "Fuera",
            x: MAP_W + 10,
            y: MAP_H + 10,
            width: 50,
            height: 50,
            properties: [{ name: "kind", type: "string", value: "open" }],
          },
        ]),
      ],
    });
    expect(() => parseTiledFeatures(tmj)).toThrow(/feature_out_of_bounds/);
  });
});

// ── 2.8 Más de 200 features ───────────────────────────────────────────────────

describe("parseTiledFeatures — límite de features", () => {
  it("rechaza mapas con más de 200 features combinadas", () => {
    const objects = Array.from({ length: 201 }, (_, i) => ({
      id: i + 1,
      name: `Zona ${i}`,
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      properties: [{ name: "kind", type: "string", value: "open" }],
    }));
    const tmj = baseTmj({ layers: [objectLayer("zones", objects)] });
    expect(() => parseTiledFeatures(tmj)).toThrow(/too_many_features/);
  });

  it("acepta exactamente 200 features", () => {
    const objects = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      name: `Zona ${i}`,
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      properties: [{ name: "kind", type: "string", value: "open" }],
    }));
    const tmj = baseTmj({ layers: [objectLayer("zones", objects)] });
    expect(() => parseTiledFeatures(tmj)).not.toThrow();
  });
});
