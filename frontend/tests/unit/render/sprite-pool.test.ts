import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpritePool } from "../../../src/render/sprite-pool.js";

interface FakeSprite {
  x: number;
  y: number;
  anims: {
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    currentFrame: { index: number };
    isPlaying: boolean;
  };
  setFrame: ReturnType<typeof vi.fn>;
}

function makeSprite(x: number, y: number): FakeSprite {
  return {
    x,
    y,
    anims: {
      play: vi.fn(),
      stop: vi.fn(),
      currentFrame: { index: 0 },
      isPlaying: false,
    },
    setFrame: vi.fn(),
  };
}

function makeCamera(cx: number, cy: number) {
  return { midPoint: { x: cx, y: cy } };
}

// 4.1 — Con 150 sprites simulados y cap=100, exactamente 100 están animados
describe("SpritePool con cap=100", () => {
  let pool: SpritePool;
  let sprites: FakeSprite[];

  beforeEach(() => {
    pool = new SpritePool({ cap: 100 });
    sprites = [];
    for (let i = 0; i < 150; i++) {
      sprites.push(makeSprite(i * 10, i * 10));
    }
  });

  it("exactamente cap sprites son marcados como activos", () => {
    const cam = makeCamera(0, 0);
    pool.update(sprites as never, cam as never);
    const active = sprites.filter((s) => s.anims.isPlaying || s.anims.play.mock.calls.length > 0);
    expect(active.length).toBe(100);
  });

  it("150 sprites − 100 activos = 50 reciben setFrame(0)", () => {
    const cam = makeCamera(0, 0);
    pool.update(sprites as never, cam as never);
    const frozen = sprites.filter((s) => s.setFrame.mock.calls.length > 0);
    expect(frozen.length).toBe(50);
  });
});

// 4.2 — Sprites fuera del cap están en frame 0 y no animados
describe("SpritePool: sprites fuera del cap", () => {
  it("sprites fuera del cap reciben setFrame(0) pero no play()", () => {
    const pool = new SpritePool({ cap: 5 });
    const sprites: FakeSprite[] = [];
    for (let i = 0; i < 10; i++) {
      sprites.push(makeSprite(i * 10, 0));
    }
    const cam = makeCamera(0, 0);
    pool.update(sprites as never, cam as never);

    const frozen = sprites.filter((s) => s.setFrame.mock.calls.length > 0);
    const animated = sprites.filter((s) => s.anims.play.mock.calls.length > 0);
    expect(frozen.length).toBe(5);
    animated.forEach((s) => expect(s.setFrame.mock.calls.length).toBe(0));
  });

  it("sprites más cercanos al centro de cámara son animados", () => {
    const pool = new SpritePool({ cap: 1 });
    const near = makeSprite(10, 10);
    const far = makeSprite(1000, 1000);
    const cam = makeCamera(0, 0);
    pool.update([near, far] as never, cam as never);
    expect(near.anims.play.mock.calls.length).toBeGreaterThan(0);
    expect(far.setFrame.mock.calls.length).toBeGreaterThan(0);
  });
});

// 4.6 — cap configurable
describe("SpritePool cap configurable", () => {
  it("cap=10 anima exactamente 10 sprites de 20", () => {
    const pool = new SpritePool({ cap: 10 });
    const sprites = Array.from({ length: 20 }, (_, i) => makeSprite(i, 0));
    pool.update(sprites as never, makeCamera(0, 0) as never);
    const animated = sprites.filter((s) => s.anims.play.mock.calls.length > 0);
    expect(animated.length).toBe(10);
  });
});
