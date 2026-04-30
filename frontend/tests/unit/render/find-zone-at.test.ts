import { describe, it, expect } from "vitest";
import { findZoneAt } from "../../../src/render/zone-renderer.js";
import type { Zone } from "@virtual-office/shared";

function rectZone(name: string, x: number, y: number, w: number, h: number): Zone {
  return { name, kind: "open", geometry: { type: "rect", x, y, w, h } };
}

function polygonZone(name: string, points: { x: number; y: number }[]): Zone {
  return { name, kind: "meeting", geometry: { type: "polygon", points } };
}

// 6.1 — findZoneAt con punto en zona rectangular devuelve esa zona
describe("findZoneAt — zona rectangular", () => {
  it("devuelve la zona cuando el punto está dentro", () => {
    const zones = [rectZone("Cocina", 0, 0, 100, 100)];
    expect(findZoneAt(50, 50, zones)?.name).toBe("Cocina");
  });

  it("devuelve null cuando el punto está fuera", () => {
    const zones = [rectZone("Cocina", 0, 0, 100, 100)];
    expect(findZoneAt(150, 50, zones)).toBeNull();
  });

  it("devuelve la zona cuando el punto está en el borde", () => {
    const zones = [rectZone("Borde", 10, 10, 80, 80)];
    expect(findZoneAt(10, 10, zones)).not.toBeNull();
  });
});

// 6.2 — findZoneAt fuera de todas las zonas devuelve null
describe("findZoneAt — sin zona", () => {
  it("devuelve null con lista vacía", () => {
    expect(findZoneAt(50, 50, [])).toBeNull();
  });

  it("devuelve null si el punto no cae en ninguna zona", () => {
    const zones = [rectZone("A", 0, 0, 50, 50), rectZone("B", 100, 100, 50, 50)];
    expect(findZoneAt(75, 75, zones)).toBeNull();
  });
});

// 6.3 — findZoneAt con polígono
describe("findZoneAt — polígono", () => {
  it("devuelve la zona cuando el punto está dentro del polígono", () => {
    // Triángulo con vértices (0,0), (100,0), (50,100)
    const zones = [
      polygonZone("Triángulo", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]),
    ];
    expect(findZoneAt(50, 40, zones)?.name).toBe("Triángulo");
  });

  it("devuelve null cuando el punto está fuera del polígono", () => {
    const zones = [
      polygonZone("Triángulo", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]),
    ];
    expect(findZoneAt(5, 99, zones)).toBeNull();
  });
});
