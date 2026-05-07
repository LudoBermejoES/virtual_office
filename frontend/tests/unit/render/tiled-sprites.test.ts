import { describe, it, expect, vi } from "vitest";
import {
  collectSpriteIds,
  enumerateSpritePlacements,
  preloadTiledSprites,
  renderTiledSprites,
} from "../../../src/render/tiled-sprites.js";
import type { SpriteManifest } from "../../../src/render/sprite-manifest.js";

interface TmjFixture {
  layers: Array<{
    type?: string;
    name?: string;
    objects?: Array<{
      point?: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      properties?: Array<{ name: string; value: unknown; type?: string }>;
    }>;
  }>;
}

function makeTmj(): TmjFixture {
  return {
    layers: [
      { type: "tilelayer", name: "ground" },
      {
        type: "objectgroup",
        name: "sprites_floor",
        objects: [
          { point: true, x: 100, y: 200, properties: [{ name: "sprite", value: "cat" }] },
        ],
      },
      { type: "tilelayer", name: "furniture" },
      {
        type: "objectgroup",
        name: "sprites_overlay",
        objects: [
          {
            point: true,
            x: 300,
            y: 400,
            properties: [
              { name: "sprite", value: "cat" },
              { name: "tag", value: "idle" },
            ],
          },
          { point: true, x: 350, y: 450, properties: [{ name: "sprite", value: "butterfly" }] },
          { width: 50, height: 50, x: 0, y: 0 }, // rectángulo
          { point: true, x: 1, y: 1 }, // sin property sprite
        ],
      },
      {
        type: "objectgroup",
        name: "npcs",
        objects: [{ point: true, x: 0, y: 0, properties: [{ name: "sprite", value: "ignored" }] }],
      },
    ],
  };
}

describe("collectSpriteIds", () => {
  it("solo ids de sprites_* layers, deduplicados", () => {
    const ids = collectSpriteIds(makeTmj() as never);
    expect(ids.sort()).toEqual(["butterfly", "cat"]);
  });

  it("layers que no empiezan por sprites_ se ignoran", () => {
    const tmj = {
      layers: [
        {
          type: "objectgroup",
          name: "npcs",
          objects: [{ point: true, properties: [{ name: "sprite", value: "ignored" }] }],
        },
      ],
    };
    expect(collectSpriteIds(tmj as never)).toEqual([]);
  });

  it("vacío si no hay layers", () => {
    expect(collectSpriteIds({} as never)).toEqual([]);
  });
});

describe("enumerateSpritePlacements", () => {
  it("asigna depth = índice del object layer en tmj.layers[]", () => {
    const placements = enumerateSpritePlacements(makeTmj() as never);
    // layer "sprites_floor" está en índice 1, "sprites_overlay" en 3
    const floor = placements.find((p) => p.layerName === "sprites_floor")!;
    const overlay = placements.find((p) => p.layerName === "sprites_overlay" && p.id === "cat")!;
    expect(floor.depth).toBe(1);
    expect(overlay.depth).toBe(3);
  });

  it("propaga property tag", () => {
    const placements = enumerateSpritePlacements(makeTmj() as never);
    const withTag = placements.find((p) => p.id === "cat" && p.depth === 3)!;
    expect(withTag.tag).toBe("idle");
  });

  it("ignora rectángulos y objects sin property sprite", () => {
    const placements = enumerateSpritePlacements(makeTmj() as never);
    // Solo deben aparecer 3 placements válidos: cat en floor, cat en overlay, butterfly en overlay
    expect(placements).toHaveLength(3);
    const ids = placements.map((p) => p.id).sort();
    expect(ids).toEqual(["butterfly", "cat", "cat"]);
  });
});

describe("preloadTiledSprites", () => {
  function makeMockScene() {
    const loaded: Array<{ key: string; png: string; json: string }> = [];
    let isLoading = false;
    const startCalls: number[] = [];
    const scene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      cache: { json: { get: vi.fn() } },
      load: {
        aseprite: vi.fn((key: string, png: string, json: string) => {
          loaded.push({ key, png, json });
        }),
        isLoading: () => isLoading,
        start: vi.fn(() => startCalls.push(1)),
      },
      anims: { createFromAseprite: vi.fn(), exists: vi.fn().mockReturnValue(false) },
      add: { sprite: vi.fn() },
    };
    return { scene, loaded, startCalls };
  }

  const manifest: SpriteManifest = {
    cat: { png: "/cat.png", json: "/cat.json", defaultTag: "walk" },
  };

  it("ignora ids no presentes en el manifest con warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { scene, loaded } = makeMockScene();
    const tmj = {
      layers: [
        {
          type: "objectgroup",
          name: "sprites_overlay",
          objects: [{ point: true, properties: [{ name: "sprite", value: "dragon" }] }],
        },
      ],
    };
    preloadTiledSprites(scene as never, tmj as never, manifest);
    expect(loaded).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("no recarga si la textura ya existe", () => {
    const { scene, loaded } = makeMockScene();
    scene.textures.exists = vi.fn().mockReturnValue(true);
    const tmj = makeTmj();
    preloadTiledSprites(scene as never, tmj as never, manifest);
    expect(loaded).toEqual([]);
  });

  it("carga sprites del manifest referenciados", () => {
    const { scene, loaded } = makeMockScene();
    const tmj = {
      layers: [
        {
          type: "objectgroup",
          name: "sprites_overlay",
          objects: [{ point: true, properties: [{ name: "sprite", value: "cat" }] }],
        },
      ],
    };
    preloadTiledSprites(scene as never, tmj as never, manifest);
    expect(loaded).toEqual([{ key: "cat", png: "/cat.png", json: "/cat.json" }]);
  });
});

describe("renderTiledSprites", () => {
  function makeMockScene(textureExists = true) {
    const sprites: Array<{ x: number; y: number; depth?: number; key?: string }> = [];
    const playCalls: Array<{ key: string }> = [];
    const scene = {
      textures: { exists: vi.fn().mockReturnValue(textureExists) },
      cache: {
        json: {
          get: vi.fn().mockReturnValue({ meta: { frameTags: [{ name: "fallback" }] } }),
        },
      },
      anims: { createFromAseprite: vi.fn(), exists: vi.fn().mockReturnValue(false) },
      add: {
        sprite: vi.fn().mockImplementation((x: number, y: number, key: string) => {
          const s = {
            x,
            y,
            key,
            setDepth: vi.fn(function (this: { depth?: number }, d: number) {
              this.depth = d;
              return this;
            }),
            play: vi.fn(({ key: animKey }: { key: string }) => {
              playCalls.push({ key: animKey });
            }),
          };
          sprites.push(s as never);
          return s;
        }),
      },
    };
    return { scene, sprites, playCalls };
  }

  const manifest: SpriteManifest = {
    cat: { png: "/cat.png", json: "/cat.json", defaultTag: "walk" },
    butterfly: { png: "/b.png", json: "/b.json" },
  };

  it("crea un sprite por cada placement con setDepth y play(tag)", () => {
    const { scene, sprites, playCalls } = makeMockScene();
    const tmj = makeTmj();
    const result = renderTiledSprites(scene as never, tmj as never, manifest);
    expect(result).toHaveLength(3);
    // El cat con tag "idle" en el overlay
    const catIdle = playCalls.find((c) => c.key === "idle");
    expect(catIdle).toBeDefined();
    // El cat sin tag usa defaultTag "walk"
    expect(playCalls.filter((c) => c.key === "walk")).toHaveLength(1);
    // butterfly sin tag y sin defaultTag → primera del JSON ("fallback")
    expect(playCalls.find((c) => c.key === "fallback")).toBeDefined();
    // depths
    expect(sprites.map((s) => s.depth).sort()).toEqual([1, 3, 3]);
  });

  it("sprite no presente en manifest se ignora", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { scene, sprites } = makeMockScene();
    const tmj = {
      layers: [
        {
          type: "objectgroup",
          name: "sprites_x",
          objects: [{ point: true, properties: [{ name: "sprite", value: "dragon" }] }],
        },
      ],
    };
    renderTiledSprites(scene as never, tmj as never, manifest);
    expect(sprites).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
