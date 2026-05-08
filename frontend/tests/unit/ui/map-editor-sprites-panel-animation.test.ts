import { describe, it, expect } from "vitest";
import { buildSpriteAnimationCss } from "../../../src/ui/map-editor-sprites-panel-animation.js";

const catJson = {
  frames: {
    "0": { frame: { x: 0, y: 0, w: 144, h: 48 }, duration: 100 },
    "1": { frame: { x: 144, y: 0, w: 144, h: 48 }, duration: 100 },
    "2": { frame: { x: 288, y: 0, w: 144, h: 48 }, duration: 100 },
  },
  meta: {
    frameTags: [{ name: "walk", from: 0, to: 2 }],
  },
};

const candleJson = {
  frames: {
    "0": { frame: { x: 0, y: 0, w: 48, h: 96 }, duration: 150 },
    "1": { frame: { x: 48, y: 0, w: 48, h: 96 }, duration: 150 },
    "2": { frame: { x: 96, y: 0, w: 48, h: 96 }, duration: 150 },
  },
  meta: {
    frameTags: [{ name: "idle", from: 0, to: 2 }],
  },
};

describe("buildSpriteAnimationCss", () => {
  it("escala el frame al targetHeight manteniendo el ratio (cat 144x48 → 96x32)", () => {
    const r = buildSpriteAnimationCss(catJson, "walk", "cat", 32);
    expect(r).not.toBeNull();
    expect(r!.frameHeightScaled).toBe(32);
    // 144 * (32/48) = 96
    expect(r!.frameWidthScaled).toBe(96);
    expect(r!.totalFrames).toBe(3);
    expect(r!.keyframesName).toBe("vo-sprite-anim-cat");
    expect(r!.keyframes).toContain("@keyframes vo-sprite-anim-cat");
    // 3 frames de 96px escalados = 288px total
    expect(r!.keyframes).toContain("-288px");
    expect(r!.animation).toBe("vo-sprite-anim-cat 300ms steps(3) infinite");
  });

  it("escala correctamente sprites con frame más alto que ancho (candle 48x96 → 16x32)", () => {
    const r = buildSpriteAnimationCss(candleJson, "idle", "candle", 32);
    expect(r).not.toBeNull();
    // 48 * (32/96) = 16
    expect(r!.frameWidthScaled).toBe(16);
    expect(r!.frameHeightScaled).toBe(32);
    // 3 frames de 16px = 48px total
    expect(r!.keyframes).toContain("-48px");
    expect(r!.animation).toBe("vo-sprite-anim-candle 450ms steps(3) infinite");
  });

  it("usa el primer tag disponible si el tag pedido no existe", () => {
    const r = buildSpriteAnimationCss(catJson, "doesnt-exist", "cat", 32);
    expect(r).not.toBeNull();
    expect(r!.animation).toContain("steps(3)");
  });

  it("usa el primer tag si no se pasa tagName", () => {
    const r = buildSpriteAnimationCss(catJson, undefined, "cat", 32);
    expect(r).not.toBeNull();
    expect(r!.animation).toContain("steps(3)");
  });

  it("devuelve null si no hay JSON", () => {
    expect(buildSpriteAnimationCss(undefined, "walk", "cat", 32)).toBeNull();
  });

  it("devuelve null si no hay frameTags ni tag", () => {
    const noTags = { frames: catJson.frames, meta: { frameTags: [] } };
    expect(buildSpriteAnimationCss(noTags, undefined, "cat", 32)).toBeNull();
  });

  it("escapa caracteres no-id en el spriteId para el keyframesName", () => {
    const r = buildSpriteAnimationCss(catJson, "walk", "with space/and-slash", 32);
    expect(r!.keyframesName).toMatch(/^vo-sprite-anim-[a-z0-9_-]+$/i);
  });

  it("respeta otros targetHeight (64) escalando proporcionalmente", () => {
    const r = buildSpriteAnimationCss(catJson, "walk", "cat", 64);
    expect(r!.frameHeightScaled).toBe(64);
    // 144 * (64/48) = 192
    expect(r!.frameWidthScaled).toBe(192);
    // 3 * 192 = 576 total
    expect(r!.keyframes).toContain("-576px");
  });
});
