import { describe, it, expect, vi } from "vitest";
import { placeSeatSprite, seatTint } from "../../../src/render/seat-sprite.js";
import { colorForUser, hslToRgb, rgbToInt } from "../../../src/render/avatar-helpers.js";

// Mock de escena mínimo para tests unitarios (sin Phaser real)
function makeScene(hasSpritesheet = true) {
  const sprite = {
    setTint: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    play: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
  };
  const scene = {
    textures: {
      exists: vi.fn().mockReturnValue(hasSpritesheet),
    },
    add: {
      sprite: vi.fn().mockReturnValue(sprite),
    },
    anims: {
      exists: vi.fn().mockReturnValue(true),
    },
  };
  return { scene, sprite };
}

// 2.1 — placeSeatSprite aplica el tint correcto y determinístico
describe("seatTint", () => {
  it("devuelve un número entero para cualquier userId", () => {
    const t = seatTint(42);
    expect(typeof t).toBe("number");
    expect(Number.isInteger(t)).toBe(true);
  });

  it("es determinístico: mismo userId produce mismo tint", () => {
    expect(seatTint(7)).toBe(seatTint(7));
    expect(seatTint(99)).toBe(seatTint(99));
  });

  it("userId distintos producen valores distintos (alta probabilidad)", () => {
    const tints = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seatTint));
    expect(tints.size).toBeGreaterThan(4);
  });

  it("coincide con el cálculo basado en colorForUser", () => {
    const userId = 123;
    const expected = rgbToInt(hslToRgb(colorForUser(userId)));
    expect(seatTint(userId)).toBe(expected);
  });
});

describe("placeSeatSprite", () => {
  it("crea el sprite con el tint correcto para el userId", () => {
    const { scene, sprite } = makeScene();
    placeSeatSprite(scene as never, 100, 200, 42);
    expect(scene.add.sprite).toHaveBeenCalledWith(100, 200, "desk-sit", 0);
    expect(sprite.setTint).toHaveBeenCalledWith(seatTint(42));
  });

  it("el tint es determinístico: llamadas distintas con mismo userId producen mismo tint", () => {
    const { scene: scene1, sprite: sprite1 } = makeScene();
    const { scene: scene2, sprite: sprite2 } = makeScene();
    placeSeatSprite(scene1 as never, 0, 0, 5);
    placeSeatSprite(scene2 as never, 0, 0, 5);
    const call1 = sprite1.setTint.mock.calls[0]![0];
    const call2 = sprite2.setTint.mock.calls[0]![0];
    expect(call1).toBe(call2);
  });

  it("retorna null si el spritesheet no está cargado", () => {
    const { scene } = makeScene(false);
    const result = placeSeatSprite(scene as never, 100, 200, 42);
    expect(result).toBeNull();
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });
});

// 2.2 — placeSeatSprite no renderiza sprite en desks sin booking
describe("placeSeatSprite sin booking", () => {
  it("con userId=0 (sin booking) no crea ningún sprite", () => {
    const { scene } = makeScene();
    const result = placeSeatSprite(scene as never, 100, 200, 0);
    expect(result).toBeNull();
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });
});
