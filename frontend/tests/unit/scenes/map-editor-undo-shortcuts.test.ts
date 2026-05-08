/**
 * Test unit dedicado al wiring de atajos Ctrl+Z / Ctrl+Shift+Z en
 * MapEditorScene (sección 1.9 del change 025).
 *
 * Mockeamos Phaser y los paneles igual que el resto de tests de la escena, y
 * capturamos el handler registrado vía `input.keyboard.on("keydown-Z", cb)`
 * para invocarlo con KeyboardEvents sintéticos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapEditorStore } from "../../../src/state/map-editor.js";

const keyboardHandlers = new Map<string, (ev: unknown) => void>();

vi.mock("phaser", () => {
  const createSprite = (x: number, y: number, key: string) => ({
    x,
    y,
    key,
    depth: 0,
    displayWidth: 48,
    displayHeight: 48,
    anims: {
      currentAnim: null as { key: string } | null,
      isPlaying: false,
      exists: (_k: string) => true,
      get: (_k: string) => ({ frames: [{ duration: 100 }] }),
    },
    setPosition() {
      return this;
    },
    setDepth(d: number) {
      this.depth = d;
      return this;
    },
    setVisible() {
      return this;
    },
    setInteractive() {
      return this;
    },
    setData() {
      return this;
    },
    on() {
      return this;
    },
    play() {
      return this;
    },
    destroy() {},
  });

  const createRect = () => ({
    x: 0,
    y: 0,
    depth: 0,
    setStrokeStyle() {
      return this;
    },
    setFillStyle() {
      return this;
    },
    setPosition() {
      return this;
    },
    setSize() {
      return this;
    },
    setDepth() {
      return this;
    },
    destroy() {},
  });

  class Scene {
    cache = {
      json: { get: vi.fn(), add: vi.fn(), has: vi.fn(() => true) },
      tilemap: { add: vi.fn() },
    };
    load = {
      json: vi.fn(),
      image: vi.fn(),
      aseprite: vi.fn(),
      isLoading: () => false,
      once: vi.fn(),
    };
    add = {
      text: vi.fn(() => ({
        setOrigin() {
          return this;
        },
        setScrollFactor() {
          return this;
        },
        setDepth() {
          return this;
        },
        setInteractive() {
          return this;
        },
        on() {
          return this;
        },
        setText() {
          return this;
        },
        setColor() {
          return this;
        },
        setAlpha() {
          return this;
        },
        destroy() {},
      })),
      sprite: vi.fn(createSprite),
      rectangle: vi.fn(createRect),
    };
    make = {
      tilemap: vi.fn(() => ({
        layers: [],
        tileWidth: 32,
        tileHeight: 32,
        addTilesetImage: vi.fn(() => null),
        createLayer: vi.fn(),
      })),
    };
    cameras = { main: { scrollX: 0, scrollY: 0, zoom: 1 } };
    textures = { exists: vi.fn(() => true) };
    anims = {
      createFromAseprite: vi.fn(),
      exists: vi.fn(() => true),
      get: vi.fn(() => ({ frames: [{ duration: 100 }] })),
    };
    game = { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } };
    input = {
      on: vi.fn(),
      keyboard: {
        on: vi.fn((evt: string, cb: (ev: unknown) => void) => {
          keyboardHandlers.set(evt, cb);
        }),
      },
    };
    events = { once: vi.fn() };
    scene = { stop: vi.fn(), start: vi.fn(), launch: vi.fn(), restart: vi.fn() };
    constructor(_cfg?: unknown) {}
  }
  return {
    default: {
      Scene,
      Loader: { Events: { COMPLETE: "complete" } },
      Scenes: { Events: { SHUTDOWN: "shutdown" } },
    },
    Scene,
    Loader: { Events: { COMPLETE: "complete" } },
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
  };
});

vi.mock("../../../src/render/tiled-sprites.js", () => ({
  preloadTiledSprites: vi.fn(),
  renderTiledSprites: vi.fn(() => []),
}));

vi.mock("../../../src/render/sprite-manifest.js", () => ({
  SPRITE_MANIFEST: { cat: { png: "/cat.png", json: "/cat.json", defaultTag: "walk" } },
}));

vi.mock("../../../src/config.js", () => ({ BASE_URL: "http://test.local" }));

vi.mock("../../../src/ui/map-editor-layers-panel.js", () => ({
  mountMapEditorLayersPanel: vi.fn(),
  unmountMapEditorLayersPanel: vi.fn(),
}));

vi.mock("../../../src/ui/map-editor-sprites-panel.js", () => ({
  mountMapEditorSpritesPanel: vi.fn(),
  unmountMapEditorSpritesPanel: vi.fn(),
}));

vi.mock("../../../src/ui/map-editor-sprite-popover.js", () => ({
  mountMapEditorSpritePopover: vi.fn(),
  unmountMapEditorSpritePopover: vi.fn(),
}));

import { MapEditorScene } from "../../../src/scenes/MapEditorScene.js";

const fakeOffice = { id: 7, tilesets: [] };

const fakeTmj = {
  width: 10,
  height: 10,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "ground" },
    {
      type: "objectgroup",
      name: "sprites_floor",
      objects: [
        {
          id: 1,
          point: true,
          x: 50,
          y: 60,
          properties: [{ name: "sprite", value: "cat" }],
        },
      ],
    },
  ],
};

function bootScene(): MapEditorScene {
  keyboardHandlers.clear();
  const scene = new MapEditorScene();
  scene.init({ office: fakeOffice });
  (scene.cache.json.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    tmj: fakeTmj,
    tmj_hash: "deadbeef".repeat(8),
    tmj_filename: "map.tmj",
  });
  scene.create();
  return scene;
}

describe("MapEditorScene — atajos undo/redo", () => {
  beforeEach(() => {
    keyboardHandlers.clear();
  });

  it("Ctrl+Z dispara undo, Ctrl+Shift+Z dispara redo", () => {
    bootScene();

    // El estado inicial trae sprites_floor con 1 sprite (del TMJ).
    expect(mapEditorStore.getState().spritesLayers["sprites_floor"]!.objects).toHaveLength(1);

    // Mutación: añadir una capa nueva
    mapEditorStore.getState().addLayer("sprites_b");
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).toContain("sprites_b");

    // Ctrl+Z → undo
    const handler = keyboardHandlers.get("keydown-Z");
    expect(handler).toBeDefined();
    handler!({ ctrlKey: true, metaKey: false, shiftKey: false, repeat: false, preventDefault() {} });
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).not.toContain("sprites_b");

    // Ctrl+Shift+Z → redo
    handler!({ ctrlKey: true, metaKey: false, shiftKey: true, repeat: false, preventDefault() {} });
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).toContain("sprites_b");
  });

  it("Cmd+Z (metaKey) también dispara undo", () => {
    bootScene();
    mapEditorStore.getState().addLayer("sprites_z");
    const handler = keyboardHandlers.get("keydown-Z");
    handler!({ ctrlKey: false, metaKey: true, shiftKey: false, repeat: false, preventDefault() {} });
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).not.toContain("sprites_z");
  });

  it("Z sin modificadores no hace nada", () => {
    bootScene();
    mapEditorStore.getState().addLayer("sprites_z");
    const handler = keyboardHandlers.get("keydown-Z");
    handler!({ ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, preventDefault() {} });
    // sprites_z sigue ahí porque no se hizo undo.
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).toContain("sprites_z");
  });

  it("event.repeat se ignora (no spam de undos)", () => {
    bootScene();
    mapEditorStore.getState().addLayer("sprites_z");
    const handler = keyboardHandlers.get("keydown-Z");
    handler!({ ctrlKey: true, metaKey: false, shiftKey: false, repeat: true, preventDefault() {} });
    expect(Object.keys(mapEditorStore.getState().spritesLayers)).toContain("sprites_z");
  });
});
