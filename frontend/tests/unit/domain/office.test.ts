import { describe, it, expect } from "vitest";
import { computeMapScale } from "../../../src/domain/office.js";

describe("computeMapScale", () => {
  it("retorna el factor menor cuando el canvas es más alto que ancho relativo al mapa", () => {
    expect(computeMapScale(800, 600, 1600, 1200)).toBeCloseTo(0.5);
  });

  it("retorna 1 si las dimensiones del mapa coinciden con el canvas", () => {
    expect(computeMapScale(800, 600, 800, 600)).toBe(1);
  });

  it("escala hacia arriba si el mapa es más pequeño", () => {
    expect(computeMapScale(1600, 1200, 800, 600)).toBe(2);
  });

  it("retorna 1 si el mapa tiene dimensiones inválidas", () => {
    expect(computeMapScale(800, 600, 0, 0)).toBe(1);
  });
});
