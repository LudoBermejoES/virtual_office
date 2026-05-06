import { describe, it, expect } from "vitest";
import { buildMonthGrid } from "../../../src/ui/day-picker-grid.js";

const HORIZON = { history: 30, horizon: 60 };

describe("buildMonthGrid", () => {
  it("mayo 2026 con today=2026-05-06: 6 filas, primera fila empieza en lunes", () => {
    const grid = buildMonthGrid(2026, 4, "2026-05-06", HORIZON);
    expect(grid.weeks).toHaveLength(6);
    grid.weeks.forEach((w) => expect(w).toHaveLength(7));
    // 1 mayo 2026 fue viernes → la primera fila debe empezar en lunes 27 abril
    expect(grid.weeks[0]![0]!.iso).toBe("2026-04-27");
    expect(grid.weeks[0]![0]!.inMonth).toBe(false);
    expect(grid.weeks[0]![4]!.iso).toBe("2026-05-01");
    expect(grid.weeks[0]![4]!.inMonth).toBe(true);
  });

  it("hoy aparece marcado isToday=true", () => {
    const grid = buildMonthGrid(2026, 4, "2026-05-06", HORIZON);
    const todayCell = grid.weeks.flat().find((c) => c.iso === "2026-05-06")!;
    expect(todayCell.isToday).toBe(true);
    const otherCell = grid.weeks.flat().find((c) => c.iso === "2026-05-07")!;
    expect(otherCell.isToday).toBe(false);
  });

  it("días anteriores a hoy - 30 días están fuera de horizonte", () => {
    const grid = buildMonthGrid(2026, 3, "2026-05-06", HORIZON); // abril 2026
    // 2026-04-05 está a 31 días → fuera
    const farPast = grid.weeks.flat().find((c) => c.iso === "2026-04-05")!;
    expect(farPast.isOutOfHorizon).toBe(true);
    // 2026-04-07 está a 29 días → dentro
    const recent = grid.weeks.flat().find((c) => c.iso === "2026-04-07")!;
    expect(recent.isOutOfHorizon).toBe(false);
  });

  it("días posteriores a hoy + 59 días están fuera de horizonte", () => {
    const grid = buildMonthGrid(2026, 6, "2026-05-06", HORIZON); // julio 2026
    // 2026-07-04 está a 59 días → dentro (último válido)
    const lastValid = grid.weeks.flat().find((c) => c.iso === "2026-07-04")!;
    expect(lastValid.isOutOfHorizon).toBe(false);
    // 2026-07-05 está a 60 días → fuera
    const overflow = grid.weeks.flat().find((c) => c.iso === "2026-07-05")!;
    expect(overflow.isOutOfHorizon).toBe(true);
  });

  it("días del mes anterior/siguiente tienen inMonth=false", () => {
    const grid = buildMonthGrid(2026, 4, "2026-05-06", HORIZON);
    // 2026-04-30 (mes anterior)
    const prev = grid.weeks.flat().find((c) => c.iso === "2026-04-30")!;
    expect(prev.inMonth).toBe(false);
    // 2026-06-01 (mes siguiente, podría aparecer al final)
    const next = grid.weeks.flat().find((c) => c.iso === "2026-06-01");
    if (next) expect(next.inMonth).toBe(false);
  });

  it("prevMonthDisabled cuando todo el mes anterior está fuera de horizonte", () => {
    // hoy=2026-05-06, history=30 → minIso=2026-04-06
    // mes anterior visualizado siendo enero 2026: dim=31, lastIso=2026-01-31 < 2026-04-06 → disabled
    const grid = buildMonthGrid(2026, 1, "2026-05-06", HORIZON); // febrero 2026
    expect(grid.prevMonthDisabled).toBe(true);
  });

  it("nextMonthDisabled cuando todo el mes siguiente está fuera de horizonte", () => {
    // hoy=2026-05-06, horizon=60 → maxIso=2026-07-04
    // visualizando agosto 2026 (mes siguiente=septiembre 2026, firstIso=2026-09-01 > 2026-07-04)
    const grid = buildMonthGrid(2026, 7, "2026-05-06", HORIZON);
    expect(grid.nextMonthDisabled).toBe(true);
  });

  it("prev/next no deshabilitados en mes con vecinos válidos", () => {
    const grid = buildMonthGrid(2026, 4, "2026-05-06", HORIZON);
    expect(grid.prevMonthDisabled).toBe(false);
    expect(grid.nextMonthDisabled).toBe(false);
  });
});
