import { describe, it, expect } from "vitest";
import { parseDesksFromTiled } from "../../../src/domain/desks-from-tiled.js";

describe("parseDesksFromTiled", () => {
  it("retorna [] si no hay object layer 'desks'", () => {
    const r = parseDesksFromTiled({ layers: [{ type: "tilelayer", name: "ground" }] });
    expect(r.desks).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("extrae point objects con (name, x, y)", () => {
    const r = parseDesksFromTiled({
      layers: [
        {
          type: "objectgroup",
          name: "desks",
          objects: [
            { id: 1, name: "A1", x: 100, y: 110, point: true },
            { id: 2, name: "A2", x: 200, y: 220, point: true },
          ],
        },
      ],
    });
    expect(r.desks).toEqual([
      { label: "A1", x: 100, y: 110, objectId: 1 },
      { label: "A2", x: 200, y: 220, objectId: 2 },
    ]);
  });

  it("toma el centro de objetos rectángulo como (x, y)", () => {
    const r = parseDesksFromTiled({
      layers: [
        {
          type: "objectgroup",
          name: "desks",
          objects: [{ id: 5, name: "B1", x: 100, y: 100, width: 40, height: 40 }],
        },
      ],
    });
    expect(r.desks).toEqual([{ label: "B1", x: 120, y: 120, objectId: 5 }]);
  });

  it("ignora ellipses y polígonos con warning unsupported_object_type", () => {
    const r = parseDesksFromTiled({
      layers: [
        {
          type: "objectgroup",
          name: "desks",
          objects: [
            { id: 7, name: "elip", x: 0, y: 0, width: 20, height: 20, ellipse: true },
            { id: 8, name: "poly", x: 0, y: 0, polygon: [] },
          ],
        },
      ],
    });
    expect(r.desks).toEqual([]);
    expect(r.warnings).toEqual([
      { objectId: 7, reason: "unsupported_object_type" },
      { objectId: 8, reason: "unsupported_object_type" },
    ]);
  });

  it("autogenera labels T1, T2, … cuando name está vacío", () => {
    const r = parseDesksFromTiled({
      layers: [
        {
          type: "objectgroup",
          name: "desks",
          objects: [
            { id: 1, x: 50, y: 50, point: true },
            { id: 2, name: "", x: 100, y: 100, point: true },
            { id: 3, name: "explicit", x: 150, y: 150, point: true },
            { id: 4, x: 200, y: 200, point: true },
          ],
        },
      ],
    });
    expect(r.desks.map((d) => d.label)).toEqual(["T1", "T2", "explicit", "T3"]);
  });
});
