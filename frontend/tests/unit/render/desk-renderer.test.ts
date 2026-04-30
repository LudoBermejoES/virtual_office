import { describe, it, expect } from "vitest";
import { deskCorners } from "../../../src/render/desk-renderer.js";
import { DESK_HALF } from "@virtual-office/shared";

describe("deskCorners", () => {
  it("calcula esquinas centradas en (x, y) con DESK_HALF", () => {
    const c = deskCorners(160, 110);
    expect(c.left).toBe(160 - DESK_HALF);
    expect(c.top).toBe(110 - DESK_HALF);
    expect(c.right).toBe(160 + DESK_HALF);
    expect(c.bottom).toBe(110 + DESK_HALF);
  });

  it("simétrico respecto al centro", () => {
    const c = deskCorners(0, 0);
    expect(c.right - c.left).toBe(DESK_HALF * 2);
    expect(c.bottom - c.top).toBe(DESK_HALF * 2);
  });
});
