import { describe, it, expect } from "vitest";
import { addDays, formatLong, withinHorizon } from "@virtual-office/shared";

describe("addDays", () => {
  it("cruza fin de mes (2026-04-30 + 1 = 2026-05-01)", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
  });

  it("cruza año (2026-12-31 + 1 = 2027-01-01)", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("retrocede un día (2026-05-01 - 1 = 2026-04-30)", () => {
    expect(addDays("2026-05-01", -1)).toBe("2026-04-30");
  });

  it("0 días devuelve la misma fecha", () => {
    expect(addDays("2026-05-04", 0)).toBe("2026-05-04");
  });
});

describe("formatLong", () => {
  it("formatea jueves 7 de mayo de 2026 en es-ES", () => {
    const result = formatLong("2026-05-07", "es-ES");
    expect(result.toLowerCase()).toContain("jueves");
    expect(result.toLowerCase()).toContain("7 de mayo");
    expect(result).toContain("2026");
  });
});

describe("withinHorizon", () => {
  const today = "2026-05-04";

  it("true para hoy", () => {
    expect(withinHorizon(today, today, 30, 59)).toBe(true);
  });

  it("true en límite inferior (hoy-30)", () => {
    expect(withinHorizon(addDays(today, -30), today, 30, 59)).toBe(true);
  });

  it("true en límite superior (hoy+59)", () => {
    expect(withinHorizon(addDays(today, 59), today, 30, 59)).toBe(true);
  });

  it("false un día antes del límite inferior", () => {
    expect(withinHorizon(addDays(today, -31), today, 30, 59)).toBe(false);
  });

  it("false un día después del límite superior", () => {
    expect(withinHorizon(addDays(today, 60), today, 30, 59)).toBe(false);
  });
});
