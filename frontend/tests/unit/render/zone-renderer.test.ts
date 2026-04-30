import { describe, it, expect } from "vitest";
import { ZONE_COLORS, zoneAlpha, labelFontClass } from "../../../src/render/zone-renderer.js";

// 5.1 — drawZone con rect produce el color correcto según kind
describe("ZONE_COLORS", () => {
  it("kitchen tiene un color distinto de open", () => {
    expect(ZONE_COLORS["kitchen"]).toBeDefined();
    expect(ZONE_COLORS["open"]).toBeDefined();
    expect(ZONE_COLORS["kitchen"]).not.toBe(ZONE_COLORS["open"]);
  });

  it("todos los kinds del enum tienen un color asignado", () => {
    const kinds = ["open", "meeting", "kitchen", "phone-booth", "hall"] as const;
    for (const k of kinds) {
      expect(typeof ZONE_COLORS[k]).toBe("number");
    }
  });
});

// 5.1 — alpha constante
describe("zoneAlpha", () => {
  it("devuelve un valor entre 0 y 1", () => {
    expect(zoneAlpha).toBeGreaterThan(0);
    expect(zoneAlpha).toBeLessThanOrEqual(1);
  });
});

// 5.3 — Labels con font="display" producen clase font-display, font="body" → font-body
describe("labelFontClass", () => {
  it("font=display produce font-display", () => {
    expect(labelFontClass("display")).toBe("font-display");
  });

  it("font=body produce font-body", () => {
    expect(labelFontClass("body")).toBe("font-body");
  });
});
