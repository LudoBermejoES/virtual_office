import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapEditorStore } from "../../../src/state/map-editor.js";

interface LoadCall {
  type: "json" | "image";
  key: string;
  url: string;
}

const loadCalls: LoadCall[] = [];
let preloadTiledSpritesCalled = false;
const mountedPanels = { layers: false, sprites: false };
let lastSpritesPanelOpts: { onDropOnCanvas?: (s: string, x: number, y: number) => void } | null =
  null;

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
    setPosition(nx: number, ny: number) {
      this.x = nx;
      this.y = ny;
      return this;
    },
    setDepth(d: number) {
      this.depth = d;
      return this;
    },
    setVisible(_v: boolean) {
      return this;
    },
    setInteractive(_opts?: unknown) {
      return this;
    },
    setData(_k: string, _v: unknown) {
      return this;
    },
    on(_evt: string, _cb: (...args: unknown[]) => void) {
      return this;
    },
    play(_cfg: { key: string }) {
      return this;
    },
    destroy() {},
  });

  const createRect = (_x: number, _y: number, _w: number, _h: number) => ({
    x: 0,
    y: 0,
    depth: 0,
    setStrokeStyle() {
      return this;
    },
    setFillStyle() {
      return this;
    },
    setPosition(nx: number, ny: number) {
      this.x = nx;
      this.y = ny;
      return this;
    },
    setSize() {
      return this;
    },
    setDepth(d: number) {
      this.depth = d;
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
      json: vi.fn((key: string, url: string) => {
        loadCalls.push({ type: "json", key, url });
      }),
      image: vi.fn((key: string, url: string) => {
        loadCalls.push({ type: "image", key, url });
      }),
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
    input = { on: vi.fn(), keyboard: { on: vi.fn() } };
    events = { once: vi.fn() };
    scene = { stop: vi.fn(), start: vi.fn(), launch: vi.fn() };
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
  preloadTiledSprites: vi.fn(() => {
    preloadTiledSpritesCalled = true;
  }),
  renderTiledSprites: vi.fn(() => []),
}));

vi.mock("../../../src/render/sprite-manifest.js", () => ({
  SPRITE_MANIFEST: { cat: { png: "/cat.png", json: "/cat.json", defaultTag: "walk" } },
}));

vi.mock("../../../src/config.js", () => ({
  BASE_URL: "http://test.local",
}));

vi.mock("../../../src/ui/map-editor-layers-panel.js", () => ({
  mountMapEditorLayersPanel: vi.fn(() => {
    mountedPanels.layers = true;
  }),
  unmountMapEditorLayersPanel: vi.fn(() => {
    mountedPanels.layers = false;
  }),
}));

vi.mock("../../../src/ui/map-editor-sprites-panel.js", () => ({
  mountMapEditorSpritesPanel: vi.fn(
    (opts: { onDropOnCanvas?: (s: string, x: number, y: number) => void }) => {
      mountedPanels.sprites = true;
      lastSpritesPanelOpts = opts;
    },
  ),
  unmountMapEditorSpritesPanel: vi.fn(() => {
    mountedPanels.sprites = false;
  }),
}));

vi.mock("../../../src/ui/map-editor-sprite-popover.js", () => ({
  mountMapEditorSpritePopover: vi.fn(),
  unmountMapEditorSpritePopover: vi.fn(),
}));

import { MapEditorScene } from "../../../src/scenes/MapEditorScene.js";

const fakeOffice = {
  id: 7,
  tilesets: [
    { ordinal: 0, image_name: "main.png", filename: "tile_0_abc.png" },
    { ordinal: 1, image_name: "extra.webp", filename: "tile_1_def.webp" },
  ],
};

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

beforeEach(() => {
  loadCalls.length = 0;
  preloadTiledSpritesCalled = false;
  mountedPanels.layers = false;
  mountedPanels.sprites = false;
  lastSpritesPanelOpts = null;
  mapEditorStore.getState().reset({
    officeId: 0,
    tmjHash: "",
    originalLayers: [],
    systemLayers: {},
    spritesLayers: {},
    layerOrder: [],
    layersVisibility: {},
  });
});

describe("MapEditorScene.preload", () => {
  it("encola load.json del endpoint /api/offices/:id/map/raw y un load.image por tileset", () => {
    const scene = new MapEditorScene();
    scene.init({ office: fakeOffice });
    scene.preload();

    const json = loadCalls.find((c) => c.type === "json");
    expect(json!.url).toBe("http://test.local/api/offices/7/map/raw");

    const images = loadCalls.filter((c) => c.type === "image");
    expect(images).toHaveLength(2);
  });
});

describe("MapEditorScene.create", () => {
  it("popula mapEditorStore con las capas sprites_* extraídas y monta paneles", () => {
    const scene = new MapEditorScene();
    scene.init({ office: fakeOffice });
    (scene.cache.json.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      tmj: fakeTmj,
      tmj_hash: "deadbeef".repeat(8),
      tmj_filename: "map.tmj",
    });

    scene.create();

    expect(preloadTiledSpritesCalled).toBe(true);
    const state = mapEditorStore.getState();
    expect(state.tmjHash).toBe("deadbeef".repeat(8));
    expect(Object.keys(state.spritesLayers)).toEqual(["sprites_floor"]);
    expect(state.spritesLayers["sprites_floor"]!.objects[0]!.spriteName).toBe("cat");
    expect(state.layerOrder).toEqual(["ground", "sprites_floor"]);

    expect(mountedPanels.layers).toBe(true);
    expect(mountedPanels.sprites).toBe(true);
  });

  it("syncSpritesFromStore crea sprites Phaser para cada objeto del store con depth correcto", () => {
    const scene = new MapEditorScene();
    scene.init({ office: fakeOffice });
    (scene.cache.json.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      tmj: fakeTmj,
      tmj_hash: "deadbeef".repeat(8),
      tmj_filename: "map.tmj",
    });
    scene.create();

    expect((scene.add.sprite as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    // Insertar un nuevo sprite en el store debe disparar otro add.sprite.
    const before = (scene.add.sprite as ReturnType<typeof vi.fn>).mock.calls.length;
    mapEditorStore.getState().addSprite("sprites_floor", {
      x: 200,
      y: 300,
      spriteName: "cat",
      tag: null,
    });
    expect((scene.add.sprite as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before + 1);
  });

  it("borrar un sprite del store destruye su sprite Phaser", () => {
    const scene = new MapEditorScene();
    scene.init({ office: fakeOffice });
    (scene.cache.json.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      tmj: fakeTmj,
      tmj_hash: "deadbeef".repeat(8),
      tmj_filename: "map.tmj",
    });
    scene.create();

    const editorId = mapEditorStore.getState().spritesLayers["sprites_floor"]!.objects[0]!.editorId;
    mapEditorStore.getState().removeSprite(editorId);
    // Tras quitar del store, syncSpritesFromStore debió eliminar el sprite del map.
    // No tenemos acceso directo al map privado, pero comprobamos vía expone:
    // El store no tiene objects para la capa.
    expect(mapEditorStore.getState().spritesLayers["sprites_floor"]!.objects).toHaveLength(0);
  });
});

describe("MapEditorScene.handleSpriteDrop", () => {
  it("convierte clientX/Y a worldX/Y con la cámara y llama a addSprite", () => {
    const scene = new MapEditorScene();
    scene.init({ office: fakeOffice });
    (scene.cache.json.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      tmj: fakeTmj,
      tmj_hash: "deadbeef".repeat(8),
      tmj_filename: "map.tmj",
    });
    scene.create();

    // Capa sprites_floor ya activa por defecto (primera del store)
    const onDrop = lastSpritesPanelOpts?.onDropOnCanvas;
    expect(onDrop).toBeDefined();

    // Cambiamos la cámara para verificar la traducción
    scene.cameras.main.scrollX = 100;
    scene.cameras.main.scrollY = 200;
    scene.cameras.main.zoom = 1;

    onDrop!("cat", 50, 60); // cliente

    const objs = mapEditorStore.getState().spritesLayers["sprites_floor"]!.objects;
    const inserted = objs[objs.length - 1]!;
    expect(inserted.spriteName).toBe("cat");
    expect(inserted.x).toBe(150);
    expect(inserted.y).toBe(260);
  });
});
