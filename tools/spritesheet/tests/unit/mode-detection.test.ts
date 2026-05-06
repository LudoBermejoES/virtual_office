import { describe, it, expect } from "vitest";
import {
  detectMode,
  effectiveFrameSize,
  pngInfoFromPath,
} from "../../src/mode-detection.js";
import type { FrameSizesManifest } from "../../src/frame-sizes.js";

describe("effectiveFrameSize", () => {
  it("usa el manifest cuando está presente", () => {
    const manifest: FrameSizesManifest = {
      "cat.png": { frame_width: 144, frame_height: 48 },
    };
    const size = effectiveFrameSize(pngInfoFromPath("cat.png", 1728, 48), manifest);
    expect(size.frame_width).toBe(144);
    expect(size.frame_height).toBe(48);
    expect(size.frame_count).toBe(12);
    expect(size.row_count).toBe(1);
  });

  it("asume cuadrado cuando no hay manifest", () => {
    const size = effectiveFrameSize(pngInfoFromPath("a.png", 192, 48), {});
    expect(size.frame_width).toBe(48);
    expect(size.frame_height).toBe(48);
    expect(size.frame_count).toBe(4);
    expect(size.row_count).toBe(1);
  });

  it("multi-row cuadrado (96 alto = 2 filas)", () => {
    const size = effectiveFrameSize(pngInfoFromPath("a.png", 144, 96), {});
    expect(size.frame_count).toBe(3);
    expect(size.row_count).toBe(2);
  });

  it("rechaza manifest inconsistente con dimensiones", () => {
    const manifest: FrameSizesManifest = {
      "cat.png": { frame_width: 144, frame_height: 48 },
    };
    expect(() => effectiveFrameSize(pngInfoFromPath("cat.png", 100, 48), manifest)).toThrow(
      /frame_size_mismatch/,
    );
  });

  it("rechaza PNG no cuadrado deducible sin manifest", () => {
    expect(() => effectiveFrameSize(pngInfoFromPath("x.png", 100, 48), {})).toThrow(
      /frame_size_undeducible/,
    );
  });
});

describe("detectMode", () => {
  it("todos cuadrados iguales → atlas", () => {
    const sizes = [
      effectiveFrameSize(pngInfoFromPath("a.png", 96, 48), {}),
      effectiveFrameSize(pngInfoFromPath("b.png", 144, 48), {}),
    ];
    expect(detectMode(sizes)).toBe("atlas");
  });

  it("uno rectangular del manifest → collection", () => {
    const manifest: FrameSizesManifest = {
      "cat.png": { frame_width: 144, frame_height: 48 },
    };
    const sizes = [
      effectiveFrameSize(pngInfoFromPath("a.png", 96, 48), manifest),
      effectiveFrameSize(pngInfoFromPath("cat.png", 1728, 48), manifest),
    ];
    expect(detectMode(sizes)).toBe("collection");
  });

  it("cuadrados de tamaños distintos → collection", () => {
    const sizes = [
      effectiveFrameSize(pngInfoFromPath("a.png", 96, 48), {}),
      effectiveFrameSize(pngInfoFromPath("b.png", 96, 32), {}),
    ];
    expect(detectMode(sizes)).toBe("collection");
  });

  it("vacío → atlas (default)", () => {
    expect(detectMode([])).toBe("atlas");
  });
});
