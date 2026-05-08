import { describe, it, expect } from "vitest";
import { dowOfDate, DOW_LABELS_ES } from "@virtual-office/shared";

describe("dowOfDate (ISO 8601, 0=lunes)", () => {
  it("2026-05-04 (lunes) → 0", () => {
    expect(dowOfDate("2026-05-04")).toBe(0);
  });

  it("2026-05-08 (viernes) → 4", () => {
    expect(dowOfDate("2026-05-08")).toBe(4);
  });

  it("2026-05-10 (domingo) → 6", () => {
    expect(dowOfDate("2026-05-10")).toBe(6);
  });

  it("año bisiesto: 2024-02-29 (jueves) → 3", () => {
    expect(dowOfDate("2024-02-29")).toBe(3);
  });

  it("lanza error si la fecha es inválida", () => {
    expect(() => dowOfDate("not-a-date")).toThrow(/fecha inválida/);
  });
});

describe("DOW_LABELS_ES", () => {
  it("tiene 7 entradas en orden L M X J V S D", () => {
    expect(DOW_LABELS_ES).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
  });
});
