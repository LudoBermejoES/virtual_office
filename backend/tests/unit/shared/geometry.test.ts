import { describe, it, expect } from "vitest";
import { chebyshevDistance, validateDeskPlacement } from "@virtual-office/shared";

describe("chebyshevDistance", () => {
  it("retorna 0 para el mismo punto", () => {
    expect(chebyshevDistance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
  });

  it("retorna max(|dx|, |dy|)", () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 10, y: 2 })).toBe(10);
    expect(chebyshevDistance({ x: 5, y: 5 }, { x: -5, y: 0 })).toBe(10);
  });
});

describe("validateDeskPlacement", () => {
  const bounds = { width: 800, height: 600 };

  it("ok para punto válido sin vecinos", () => {
    expect(validateDeskPlacement(160, 110, bounds, [])).toEqual({ ok: true });
  });

  it("rechaza con out_of_bounds para coords negativas", () => {
    expect(validateDeskPlacement(-1, 100, bounds, [])).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
  });

  it("rechaza con out_of_bounds para coords > bounds", () => {
    expect(validateDeskPlacement(850, 110, bounds, [])).toEqual({
      ok: false,
      reason: "out_of_bounds",
    });
  });

  it("rechaza con too_close_to_existing cuando Chebyshev < DESK_MIN_SEPARATION", () => {
    expect(validateDeskPlacement(170, 120, bounds, [{ x: 160, y: 110 }])).toEqual({
      ok: false,
      reason: "too_close_to_existing",
    });
  });

  it("admite cuando Chebyshev = DESK_MIN_SEPARATION exacto", () => {
    expect(validateDeskPlacement(212, 110, bounds, [{ x: 160, y: 110 }])).toEqual({ ok: true });
  });
});
