import { describe, it, expect, vi } from "vitest";
import { renderNpcs } from "../../../src/render/npc-renderer.js";
import type { NpcData } from "@virtual-office/shared";

function makeScene(hasTexture = true) {
  const sprites: unknown[] = [];
  const scene = {
    textures: {
      exists: vi.fn().mockReturnValue(hasTexture),
    },
    add: {
      sprite: vi.fn().mockImplementation(() => {
        const s = {
          setDepth: vi.fn().mockReturnThis(),
          play: vi.fn().mockReturnThis(),
        };
        sprites.push(s);
        return s;
      }),
    },
    anims: {
      exists: vi.fn().mockReturnValue(true),
    },
  };
  return { scene, sprites };
}

// 3.3 — renderNpcs con sprite desconocido no añade ningún sprite
describe("renderNpcs", () => {
  it("NPC con sprite válido crea un sprite en la posición correcta", () => {
    const { scene, sprites } = makeScene();
    const npcs: NpcData[] = [{ id: 1, name: "gatito", x: 100, y: 200, sprite: "cat-idle" }];
    renderNpcs(scene as never, npcs);
    expect(scene.add.sprite).toHaveBeenCalledWith(100, 200, "npc-cat-idle", 0);
    expect(sprites).toHaveLength(1);
  });

  it("sprite desconocido (no en NpcSprite) no añade ningún sprite", () => {
    const { scene, sprites } = makeScene();
    const npcs = [{ id: 1, name: "dragón", x: 50, y: 50, sprite: "dragon" }] as never;
    renderNpcs(scene as never, npcs);
    expect(scene.add.sprite).not.toHaveBeenCalled();
    expect(sprites).toHaveLength(0);
  });

  it("sin texturas cargadas no crea sprites", () => {
    const { scene, sprites } = makeScene(false);
    const npcs: NpcData[] = [{ id: 1, name: "planta", x: 0, y: 0, sprite: "plant-sway" }];
    renderNpcs(scene as never, npcs);
    expect(sprites).toHaveLength(0);
  });

  it("múltiples NPCs válidos crean múltiples sprites", () => {
    const { scene, sprites } = makeScene();
    const npcs: NpcData[] = [
      { id: 1, name: "cat", x: 0, y: 0, sprite: "cat-idle" },
      { id: 2, name: "bird", x: 100, y: 100, sprite: "bird-idle" },
      { id: 3, name: "dragon", x: 200, y: 200, sprite: "dragon" as never },
    ];
    renderNpcs(scene as never, npcs);
    expect(sprites).toHaveLength(2);
  });
});
