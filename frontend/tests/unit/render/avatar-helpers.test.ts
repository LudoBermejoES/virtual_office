import { describe, it, expect } from "vitest";
import { getInitials, colorForUser, hslToRgb } from "../../../src/render/avatar-helpers.js";

describe("getInitials", () => {
  it("dos palabras → primera de cada", () => {
    expect(getInitials("Ludo Bermejo Bonafé")).toBe("LB");
  });

  it("una sola palabra → primera letra", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("cadena vacía → ?", () => {
    expect(getInitials("")).toBe("?");
  });

  it("espacios extra → trimea y devuelve dos iniciales", () => {
    expect(getInitials("  Bob  Smith  ")).toBe("BS");
  });

  it("acepta minúsculas y devuelve mayúsculas", () => {
    expect(getInitials("alice  smith")).toBe("AS");
  });
});

describe("colorForUser", () => {
  it("retorna un valor HSL determinístico para el mismo userId", () => {
    expect(colorForUser(7)).toBe(colorForUser(7));
  });

  it("formato hsl(H, 60%, 50%)", () => {
    const c = colorForUser(42);
    expect(c).toMatch(/^hsl\(\d{1,3}, 60%, 50%\)$/);
  });

  it("usuarios distintos producen colores distintos (alta probabilidad)", () => {
    const colors = new Set<string>();
    for (let i = 1; i <= 30; i++) colors.add(colorForUser(i));
    expect(colors.size).toBeGreaterThan(20);
  });
});

describe("hslToRgb", () => {
  it("hsl(0, 100%, 50%) → rojo", () => {
    expect(hslToRgb("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("hsl(120, 100%, 50%) → verde", () => {
    expect(hslToRgb("hsl(120, 100%, 50%)")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("formato inválido devuelve fallback", () => {
    const r = hslToRgb("not-a-color");
    expect(r).toEqual({ r: 0, g: 255, b: 159 });
  });
});
