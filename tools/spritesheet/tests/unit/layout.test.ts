import { describe, it, expect } from "vitest";
import { computeLayout } from "../../src/layout.js";
import type { Strip } from "../../src/strips.js";

function strip(filename: string, frameCount: number, tile = 48): Strip {
  return {
    filename,
    fullPath: `/tmp/${filename}`,
    width: frameCount * tile,
    frameCount,
    sourceRow: 0,
  };
}

describe("computeLayout", () => {
  it("strips heterogéneas: cols=max(frameCount), rows=N", () => {
    const layout = computeLayout([strip("a.png", 2), strip("b.png", 1), strip("c.png", 3)], 48);
    expect(layout.cols).toBe(3);
    expect(layout.rows).toBe(3);
    expect(layout.outWidth).toBe(144);
    expect(layout.outHeight).toBe(144);
    expect(layout.totalTiles).toBe(9);
  });

  it("firstLocalId = row * cols", () => {
    const layout = computeLayout([strip("a.png", 2), strip("b.png", 1), strip("c.png", 3)], 48);
    expect(layout.placements.map((p) => p.firstLocalId)).toEqual([0, 3, 6]);
  });

  it("vacío", () => {
    const layout = computeLayout([], 48);
    expect(layout.totalTiles).toBe(0);
    expect(layout.outWidth).toBe(0);
    expect(layout.outHeight).toBe(0);
  });
});
