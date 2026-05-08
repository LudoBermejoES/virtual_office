import { describe, it, expect, beforeEach } from "vitest";
import { mapEditorStore, UNDO_STACK_MAX } from "../../../src/state/map-editor.js";

function freshStore() {
  mapEditorStore.getState().reset({
    officeId: 1,
    tmjHash: "a".repeat(64),
    originalLayers: [],
    systemLayers: {
      ground: { raw: { type: "tilelayer", name: "ground" }, type: "tilelayer" },
    },
    spritesLayers: {},
    layerOrder: ["ground"],
    layersVisibility: { ground: true },
  });
}

describe("mapEditorStore — undo/redo", () => {
  beforeEach(freshStore);

  it("addLayer + undo deja el estado igual al inicial; redo lo restaura", () => {
    const before = mapEditorStore.getState().snapshot();
    mapEditorStore.getState().addLayer("sprites_a");
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).toEqual(["sprites_a"]);

    mapEditorStore.getState().undo();
    const undone = mapEditorStore.getState().snapshot();
    expect(undone.spritesLayers).toEqual(before.spritesLayers);
    expect(undone.layerOrder).toEqual(before.layerOrder);

    mapEditorStore.getState().redo();
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).toEqual(["sprites_a"]);
  });

  it("moveSprite + undo restaura coords; redo vuelve a moverlo", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    const id = mapEditorStore.getState().addSprite("sprites_a", {
      x: 100,
      y: 100,
      spriteName: "cat",
      tag: null,
    });
    mapEditorStore.getState().moveSprite(id, 250, 180);
    expect(mapEditorStore.getState().spritesLayers["sprites_a"]!.objects[0]!.x).toBe(250);

    mapEditorStore.getState().undo();
    expect(mapEditorStore.getState().spritesLayers["sprites_a"]!.objects[0]!.x).toBe(100);
    expect(mapEditorStore.getState().spritesLayers["sprites_a"]!.objects[0]!.y).toBe(100);

    mapEditorStore.getState().redo();
    expect(mapEditorStore.getState().spritesLayers["sprites_a"]!.objects[0]!.x).toBe(250);
    expect(mapEditorStore.getState().spritesLayers["sprites_a"]!.objects[0]!.y).toBe(180);
  });

  it("removeLayer + undo trae la capa con todos sus sprites", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mapEditorStore.getState().addSprite("sprites_a", {
      x: 1,
      y: 2,
      spriteName: "cat",
      tag: null,
    });
    mapEditorStore.getState().addSprite("sprites_a", {
      x: 3,
      y: 4,
      spriteName: "cat",
      tag: null,
    });
    expect(mapEditorStore.getState().spritesLayers["sprites_a"]!.objects).toHaveLength(2);

    mapEditorStore.getState().removeLayer("sprites_a");
    expect(mapEditorStore.getState().spritesLayers["sprites_a"]).toBeUndefined();

    mapEditorStore.getState().undo();
    const layer = mapEditorStore.getState().spritesLayers["sprites_a"]!;
    expect(layer.objects).toHaveLength(2);
    expect(layer.objects[0]!.x).toBe(1);
    expect(layer.objects[1]!.x).toBe(3);
  });

  it("toggleLayerVisibility + undo invierte el toggle", () => {
    mapEditorStore.getState().toggleLayerVisibility("ground");
    expect(mapEditorStore.getState().layersVisibility["ground"]).toBe(false);
    mapEditorStore.getState().undo();
    expect(mapEditorStore.getState().layersVisibility["ground"]).toBe(true);
    mapEditorStore.getState().redo();
    expect(mapEditorStore.getState().layersVisibility["ground"]).toBe(false);
  });

  it("redo se descarta tras una nueva operación (rama abandonada)", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mapEditorStore.getState().undo();
    // Ahora future tiene 1 elemento, redo está disponible.
    expect(mapEditorStore.getState().future).toHaveLength(1);

    // Operación nueva: future debe vaciarse.
    mapEditorStore.getState().addLayer("sprites_b");
    expect(mapEditorStore.getState().future).toHaveLength(0);

    // Tras un redo no pasa nada (future está vacío).
    mapEditorStore.getState().redo();
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).toEqual(["sprites_b"]);
  });

  it(`stack overflow: tras ${UNDO_STACK_MAX + 1} operaciones, el snapshot más antiguo cae`, () => {
    for (let i = 0; i < UNDO_STACK_MAX + 1; i++) {
      mapEditorStore.getState().addLayer(`sprites_${i}`);
    }
    expect(mapEditorStore.getState().past).toHaveLength(UNDO_STACK_MAX);
  });

  it("undo sin past: no-op", () => {
    expect(() => mapEditorStore.getState().undo()).not.toThrow();
    expect(mapEditorStore.getState().past).toHaveLength(0);
    expect(mapEditorStore.getState().future).toHaveLength(0);
  });

  it("redo sin future: no-op", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    expect(() => mapEditorStore.getState().redo()).not.toThrow();
    expect(mapEditorStore.getState().future).toHaveLength(0);
  });
});
