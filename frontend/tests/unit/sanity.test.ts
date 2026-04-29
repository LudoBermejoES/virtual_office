import { describe, it, expect } from "vitest";
import { DESK_SIZE_PX, DESK_MIN_SEPARATION } from "@shared";

describe("sanity", () => {
  it("aritmética básica", () => {
    expect(1 + 1).toBe(2);
  });

  it("constantes de shared están disponibles", () => {
    expect(DESK_SIZE_PX).toBe(48);
    expect(DESK_MIN_SEPARATION).toBeGreaterThan(DESK_SIZE_PX);
  });
});
