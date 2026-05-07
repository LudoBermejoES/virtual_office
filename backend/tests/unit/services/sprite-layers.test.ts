import { describe, it, expect } from "vitest";
import {
  PatchSpritesLayersSchema,
  SpritesLayerSchema,
  findUnknownSpriteId,
  checkCoherence,
  applyLayerEdits,
  type SpritesLayer,
  type PatchSpritesLayersBody,
} from "../../../src/services/sprite-layers.js";

const validLayer: SpritesLayer = {
  name: "sprites_overlay",
  type: "objectgroup",
  objects: [
    {
      id: 1,
      point: true,
      x: 100,
      y: 200,
      properties: [{ name: "sprite", type: "string", value: "cat" }],
    },
  ],
};

describe("SpritesLayerSchema (zod)", () => {
  it("acepta una capa válida", () => {
    expect(SpritesLayerSchema.safeParse(validLayer).success).toBe(true);
  });

  it("rechaza nombre que no empieza por sprites_", () => {
    const r = SpritesLayerSchema.safeParse({ ...validLayer, name: "decoration" });
    expect(r.success).toBe(false);
  });
});

describe("PatchSpritesLayersSchema", () => {
  it("acepta body con layer_order, sprites_layers y layers_visibility opcional", () => {
    const body = {
      expected_hash: "a".repeat(64),
      layer_order: ["ground", "sprites_overlay"],
      sprites_layers: { sprites_overlay: validLayer },
      layers_visibility: { ground: false },
    };
    expect(PatchSpritesLayersSchema.safeParse(body).success).toBe(true);
  });

  it("acepta sin layers_visibility", () => {
    const body = {
      expected_hash: "a".repeat(64),
      layer_order: [],
      sprites_layers: {},
    };
    expect(PatchSpritesLayersSchema.safeParse(body).success).toBe(true);
  });

  it("rechaza expected_hash con longitud incorrecta", () => {
    const body = {
      expected_hash: "abc",
      layer_order: [],
      sprites_layers: {},
    };
    expect(PatchSpritesLayersSchema.safeParse(body).success).toBe(false);
  });
});

describe("findUnknownSpriteId", () => {
  it("devuelve null si todos los sprites están en el manifest", () => {
    expect(findUnknownSpriteId({ sprites_overlay: validLayer })).toBeNull();
  });

  it("devuelve el id desconocido", () => {
    const layer: SpritesLayer = {
      ...validLayer,
      objects: [
        {
          ...validLayer.objects[0]!,
          properties: [{ name: "sprite", type: "string", value: "dragon" }],
        },
      ],
    };
    expect(findUnknownSpriteId({ sprites_overlay: layer })).toBe("dragon");
  });
});

const baseTmj = {
  width: 10,
  layers: [
    { type: "tilelayer", name: "ground", data: [0, 0, 0] },
    { type: "tilelayer", name: "furniture", data: [1, 1, 1] },
    { type: "objectgroup", name: "desks", objects: [{ id: 1, x: 0, y: 0 }] },
    { type: "objectgroup", name: "sprites_floor", objects: [] },
  ],
};

function makeBody(over: Partial<PatchSpritesLayersBody> = {}): PatchSpritesLayersBody {
  return {
    expected_hash: "a".repeat(64),
    layer_order: ["ground", "furniture", "desks", "sprites_overlay"],
    sprites_layers: { sprites_overlay: validLayer },
    ...over,
  };
}

describe("checkCoherence", () => {
  it("devuelve null si layer_order contiene exactamente sistema + sprites_layers", () => {
    const r = checkCoherence(baseTmj as never, makeBody());
    expect(r).toBeNull();
  });

  it("layer_order_missing_system_layer si falta una capa del sistema", () => {
    const body = makeBody({
      layer_order: ["ground", "furniture", "sprites_overlay"], // falta desks
    });
    const r = checkCoherence(baseTmj as never, body);
    expect(r).toEqual({ kind: "layer_order_missing_system_layer", missing: ["desks"] });
  });

  it("layer_order_unknown_name si aparece un nombre que no es ni sistema ni sprites_layers", () => {
    const body = makeBody({
      layer_order: ["ground", "furniture", "desks", "sprites_overlay", "foo"],
    });
    const r = checkCoherence(baseTmj as never, body);
    expect(r).toEqual({ kind: "layer_order_unknown_name", unknown: ["foo"] });
  });

  it("layer_order_duplicate si hay nombres repetidos", () => {
    const body = makeBody({
      layer_order: ["ground", "ground", "furniture", "desks", "sprites_overlay"],
    });
    const r = checkCoherence(baseTmj as never, body);
    expect(r).toEqual({ kind: "layer_order_duplicate", duplicates: ["ground"] });
  });

  it("visibility_unknown_layer si menciona una capa que no está en el TMJ resultante", () => {
    const body = makeBody({ layers_visibility: { foo: false } });
    const r = checkCoherence(baseTmj as never, body);
    expect(r).toEqual({ kind: "visibility_unknown_layer", unknown: ["foo"] });
  });

  it("sprites_layers_name_mismatch si la clave del map no coincide con layer.name", () => {
    const body = makeBody({
      layer_order: ["ground", "furniture", "desks", "sprites_overlay"],
      sprites_layers: { sprites_overlay: { ...validLayer, name: "sprites_otro" } },
    });
    const r = checkCoherence(baseTmj as never, body);
    expect(r).toEqual({
      kind: "sprites_layers_name_mismatch",
      key: "sprites_overlay",
      layerName: "sprites_otro",
    });
  });

  it("ignora `sprites_floor` original al calcular las capas del sistema", () => {
    // sprites_floor del TMJ original NO se considera "system" → no es obligatorio
    // mantenerla en layer_order. El cliente puede borrarla simplemente no
    // incluyéndola.
    const body = makeBody({
      layer_order: ["ground", "furniture", "desks", "sprites_overlay"],
    });
    expect(checkCoherence(baseTmj as never, body)).toBeNull();
  });
});

describe("applyLayerEdits", () => {
  it("reorganiza el array layers según layer_order", () => {
    const body = makeBody({
      layer_order: ["ground", "sprites_overlay", "furniture", "desks"],
    });
    const out = applyLayerEdits(baseTmj as never, body);
    expect((out.layers as Array<{ name: string }>).map((l) => l.name)).toEqual([
      "ground",
      "sprites_overlay",
      "furniture",
      "desks",
    ]);
  });

  it("preserva el contenido de las capas del sistema byte a byte", () => {
    const body = makeBody();
    const out = applyLayerEdits(baseTmj as never, body);
    const ground = (out.layers as Array<Record<string, unknown>>).find((l) => l["name"] === "ground")!;
    expect(ground).toEqual({ type: "tilelayer", name: "ground", data: [0, 0, 0] });
    const desks = (out.layers as Array<Record<string, unknown>>).find((l) => l["name"] === "desks")!;
    expect(desks).toEqual({ type: "objectgroup", name: "desks", objects: [{ id: 1, x: 0, y: 0 }] });
  });

  it("inserta las capas sprites_* desde sprites_layers", () => {
    const body = makeBody();
    const out = applyLayerEdits(baseTmj as never, body);
    const overlay = (out.layers as Array<Record<string, unknown>>).find(
      (l) => l["name"] === "sprites_overlay",
    )!;
    expect(overlay["type"]).toBe("objectgroup");
    expect(overlay["objects"]).toEqual(validLayer.objects);
  });

  it("aplica visibility a capas del sistema sin tocar el resto del contenido", () => {
    const body = makeBody({ layers_visibility: { furniture: false } });
    const out = applyLayerEdits(baseTmj as never, body);
    const furniture = (out.layers as Array<Record<string, unknown>>).find(
      (l) => l["name"] === "furniture",
    )!;
    expect(furniture["visible"]).toBe(false);
    expect(furniture["data"]).toEqual([1, 1, 1]);
    // Otras capas no cambian
    const ground = (out.layers as Array<Record<string, unknown>>).find((l) => l["name"] === "ground")!;
    expect("visible" in ground).toBe(false);
  });

  it("aplica visibility a capas sprites_*", () => {
    const body = makeBody({ layers_visibility: { sprites_overlay: false } });
    const out = applyLayerEdits(baseTmj as never, body);
    const overlay = (out.layers as Array<Record<string, unknown>>).find(
      (l) => l["name"] === "sprites_overlay",
    )!;
    expect(overlay["visible"]).toBe(false);
  });

  it("borra capas sprites_* del TMJ original que no están en layer_order ni en sprites_layers", () => {
    const body = makeBody({
      layer_order: ["ground", "furniture", "desks"], // sin ningún sprites_*
      sprites_layers: {},
    });
    const out = applyLayerEdits(baseTmj as never, body);
    expect((out.layers as Array<{ name: string }>).map((l) => l.name)).toEqual([
      "ground",
      "furniture",
      "desks",
    ]);
  });

  it("no muta el tmj de entrada", () => {
    const before = JSON.stringify(baseTmj);
    applyLayerEdits(baseTmj as never, makeBody());
    expect(JSON.stringify(baseTmj)).toBe(before);
  });
});
