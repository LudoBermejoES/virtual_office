import { describe, it, expect, beforeEach } from "vitest";
import {
  mapEditorStore,
  extractEditorStateFromTmj,
  buildPatchBody,
} from "../../../src/state/map-editor.js";

function reset() {
  mapEditorStore.getState().reset({
    officeId: 1,
    tmjHash: "a".repeat(64),
    originalLayers: [],
    systemLayers: {},
    spritesLayers: {},
    layerOrder: [],
    layersVisibility: {},
  });
}

describe("mapEditorStore — capas sprites_*", () => {
  beforeEach(reset);

  it("addLayer crea capa con name, la mete en layerOrder y la activa", () => {
    const r = mapEditorStore.getState().addLayer("sprites_floor");
    expect(r.ok).toBe(true);
    const s = mapEditorStore.getState();
    expect(Object.keys(s.spritesLayers)).toEqual(["sprites_floor"]);
    expect(s.layerOrder).toEqual(["sprites_floor"]);
    expect(s.layersVisibility["sprites_floor"]).toBe(true);
    expect(s.activeLayerName).toBe("sprites_floor");
    expect(s.isDirty).toBe(true);
  });

  it("addLayer rechaza nombre que no cumple regex", () => {
    expect(mapEditorStore.getState().addLayer("decoration")).toEqual({
      ok: false,
      reason: "invalid_name",
    });
  });

  it("addLayer rechaza nombres ya presentes en layerOrder", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    expect(mapEditorStore.getState().addLayer("sprites_a")).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("removeLayer borra de layerOrder y layersVisibility", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mapEditorStore.getState().addLayer("sprites_b");
    mapEditorStore.getState().removeLayer("sprites_b");
    const s = mapEditorStore.getState();
    expect(s.layerOrder).toEqual(["sprites_a"]);
    expect(s.layersVisibility["sprites_b"]).toBeUndefined();
  });

  it("renameLayer mantiene posición en layerOrder", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mapEditorStore.getState().addLayer("sprites_b");
    expect(mapEditorStore.getState().renameLayer("sprites_a", "sprites_x").ok).toBe(true);
    expect(mapEditorStore.getState().layerOrder).toEqual(["sprites_x", "sprites_b"]);
  });
});

describe("mapEditorStore — orden e intercalado con capas del sistema", () => {
  beforeEach(() => {
    mapEditorStore.getState().reset({
      officeId: 1,
      tmjHash: "a".repeat(64),
      originalLayers: [],
      systemLayers: {
        ground: { raw: { type: "tilelayer", name: "ground" }, type: "tilelayer" },
        furniture: { raw: { type: "tilelayer", name: "furniture" }, type: "tilelayer" },
        desks: { raw: { type: "objectgroup", name: "desks" }, type: "objectgroup" },
      },
      spritesLayers: {},
      layerOrder: ["ground", "furniture", "desks"],
      layersVisibility: { ground: true, furniture: true, desks: true },
    });
  });

  it("addLayer la inserta al final del layerOrder", () => {
    mapEditorStore.getState().addLayer("sprites_overlay");
    expect(mapEditorStore.getState().layerOrder).toEqual([
      "ground",
      "furniture",
      "desks",
      "sprites_overlay",
    ]);
  });

  it("moveLayer permite intercalar una capa sprites_* entre tilelayers", () => {
    mapEditorStore.getState().addLayer("sprites_jardin");
    // Ahora orden: [ground, furniture, desks, sprites_jardin]
    mapEditorStore.getState().moveLayer("sprites_jardin", -1); // [ground, furniture, sprites_jardin, desks]
    mapEditorStore.getState().moveLayer("sprites_jardin", -1); // [ground, sprites_jardin, furniture, desks]
    expect(mapEditorStore.getState().layerOrder).toEqual([
      "ground",
      "sprites_jardin",
      "furniture",
      "desks",
    ]);
  });

  it("moveLayer también funciona para capas del sistema", () => {
    mapEditorStore.getState().moveLayer("furniture", -1);
    expect(mapEditorStore.getState().layerOrder).toEqual(["furniture", "ground", "desks"]);
  });

  it("moveLayer no se sale de los bordes", () => {
    mapEditorStore.getState().moveLayer("ground", -1);
    expect(mapEditorStore.getState().layerOrder).toEqual(["ground", "furniture", "desks"]);
    mapEditorStore.getState().moveLayer("desks", 1);
    expect(mapEditorStore.getState().layerOrder).toEqual(["ground", "furniture", "desks"]);
  });

  it("toggleLayerVisibility cambia el flag y marca dirty", () => {
    mapEditorStore.getState().toggleLayerVisibility("furniture");
    expect(mapEditorStore.getState().layersVisibility["furniture"]).toBe(false);
    expect(mapEditorStore.getState().isDirty).toBe(true);
  });

  it("toggleLayerVisibility ignora capas inexistentes", () => {
    mapEditorStore.getState().toggleLayerVisibility("foo");
    expect(mapEditorStore.getState().isDirty).toBe(false);
  });
});

describe("mapEditorStore — sprites", () => {
  beforeEach(() => {
    reset();
    mapEditorStore.getState().addLayer("sprites_overlay");
  });

  it("addSprite añade en la capa indicada y selecciona el nuevo", () => {
    const id = mapEditorStore.getState().addSprite("sprites_overlay", {
      x: 100,
      y: 200,
      spriteName: "cat",
      tag: null,
    });
    const layer = mapEditorStore.getState().spritesLayers["sprites_overlay"]!;
    expect(layer.objects).toHaveLength(1);
    expect(layer.objects[0]!.editorId).toBe(id);
    expect(mapEditorStore.getState().selection).toBe(id);
  });

  it("moveSprite actualiza coords", () => {
    const id = mapEditorStore.getState().addSprite("sprites_overlay", {
      x: 0,
      y: 0,
      spriteName: "cat",
      tag: null,
    });
    mapEditorStore.getState().moveSprite(id, 250, 300);
    const obj = mapEditorStore.getState().spritesLayers["sprites_overlay"]!.objects[0]!;
    expect(obj.x).toBe(250);
    expect(obj.y).toBe(300);
  });

  it("removeSprite quita el objeto y limpia selección", () => {
    const id = mapEditorStore.getState().addSprite("sprites_overlay", {
      x: 0,
      y: 0,
      spriteName: "cat",
      tag: null,
    });
    mapEditorStore.getState().removeSprite(id);
    expect(mapEditorStore.getState().spritesLayers["sprites_overlay"]!.objects).toHaveLength(0);
    expect(mapEditorStore.getState().selection).toBeNull();
  });
});

describe("mapEditorStore — markSaved", () => {
  beforeEach(reset);

  it("limpia isDirty y actualiza tmjHash + initialVisibility", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mapEditorStore.getState().toggleLayerVisibility("sprites_a"); // dirty + diff con initial
    expect(mapEditorStore.getState().isDirty).toBe(true);
    mapEditorStore.getState().markSaved("b".repeat(64));
    expect(mapEditorStore.getState().isDirty).toBe(false);
    expect(mapEditorStore.getState().tmjHash).toBe("b".repeat(64));
    // initialVisibility ahora coincide con visibility actual
    expect(mapEditorStore.getState().initialVisibility["sprites_a"]).toBe(false);
  });
});

describe("extractEditorStateFromTmj", () => {
  it("separa system y sprites_*, conserva orden y visibilidad", () => {
    const tmj = {
      layers: [
        { type: "tilelayer", name: "ground" },
        {
          type: "objectgroup",
          name: "sprites_floor",
          objects: [
            {
              id: 5,
              point: true,
              x: 50,
              y: 50,
              properties: [
                { name: "sprite", value: "cat" },
                { name: "tag", value: "walk" },
              ],
            },
          ],
        },
        { type: "tilelayer", name: "furniture", visible: false },
        { type: "objectgroup", name: "desks", objects: [] },
      ],
    };
    const r = extractEditorStateFromTmj(tmj);
    expect(r.layerOrder).toEqual(["ground", "sprites_floor", "furniture", "desks"]);
    expect(r.layersVisibility).toEqual({
      ground: true,
      sprites_floor: true,
      furniture: false,
      desks: true,
    });
    expect(Object.keys(r.systemLayers).sort()).toEqual(["desks", "furniture", "ground"]);
    expect(Object.keys(r.spritesLayers)).toEqual(["sprites_floor"]);
    const cat = r.spritesLayers["sprites_floor"]!.objects[0]!;
    expect(cat.spriteName).toBe("cat");
    expect(cat.tag).toBe("walk");
    expect(cat.tiledId).toBe(5);
  });

  it("vacío si no hay layers", () => {
    const r = extractEditorStateFromTmj({});
    expect(r.layerOrder).toEqual([]);
  });
});

describe("buildPatchBody", () => {
  beforeEach(() => {
    mapEditorStore.getState().reset({
      officeId: 1,
      tmjHash: "h".repeat(64),
      originalLayers: [],
      systemLayers: {
        ground: { raw: { type: "tilelayer", name: "ground" }, type: "tilelayer" },
      },
      spritesLayers: {},
      layerOrder: ["ground"],
      layersVisibility: { ground: true },
    });
  });

  it("incluye expected_hash, layer_order y sprites_layers serializadas", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mapEditorStore.getState().addSprite("sprites_a", {
      x: 10,
      y: 20,
      spriteName: "cat",
      tag: "idle",
    });
    const body = buildPatchBody();
    expect(body.expected_hash).toBe("h".repeat(64));
    expect(body.layer_order).toEqual(["ground", "sprites_a"]);
    const layer = body.sprites_layers["sprites_a"] as {
      name: string;
      type: string;
      objects: Array<{ x: number; y: number; properties: Array<{ name: string; value: string }> }>;
    };
    expect(layer.name).toBe("sprites_a");
    expect(layer.type).toBe("objectgroup");
    expect(layer.objects).toHaveLength(1);
    expect(layer.objects[0]!.x).toBe(10);
    const props = layer.objects[0]!.properties;
    expect(props.find((p) => p.name === "sprite")!.value).toBe("cat");
    expect(props.find((p) => p.name === "tag")!.value).toBe("idle");
  });

  it("solo incluye layers_visibility con las capas cambiadas respecto al estado inicial", () => {
    // ground inicial visible:true. Si no toco nada, body NO debe traer layers_visibility.
    let body = buildPatchBody();
    expect(body.layers_visibility).toBeUndefined();

    // Toggle ground a invisible.
    mapEditorStore.getState().toggleLayerVisibility("ground");
    body = buildPatchBody();
    expect(body.layers_visibility).toEqual({ ground: false });
  });
});
