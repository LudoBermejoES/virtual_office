import { describe, it, expect } from "vitest";
import {
  parseIsoDate,
  isInWindow,
  addDaysIso,
  deskState,
} from "../../../src/domain/bookings.js";

describe("parseIsoDate", () => {
  it("acepta fecha válida YYYY-MM-DD", () => {
    expect(parseIsoDate("2026-05-04")).toEqual({ ok: true, date: "2026-05-04" });
  });

  it("rechaza 2026-13-01 (mes inválido)", () => {
    expect(parseIsoDate("2026-13-01")).toEqual({ ok: false });
  });

  it("rechaza separador no estándar 2026/05/04", () => {
    expect(parseIsoDate("2026/05/04")).toEqual({ ok: false });
  });

  it("rechaza null", () => {
    expect(parseIsoDate(null)).toEqual({ ok: false });
  });

  it("rechaza día imposible 2026-02-30", () => {
    expect(parseIsoDate("2026-02-30")).toEqual({ ok: false });
  });
});

describe("isInWindow", () => {
  const today = "2026-05-04";
  const horizon = 60;

  it("true para hoy", () => {
    expect(isInWindow(today, today, horizon)).toBe(true);
  });

  it("true para mañana", () => {
    expect(isInWindow(addDaysIso(today, 1), today, horizon)).toBe(true);
  });

  it("true para horizonte exacto", () => {
    expect(isInWindow(addDaysIso(today, horizon), today, horizon)).toBe(true);
  });

  it("false para ayer", () => {
    expect(isInWindow(addDaysIso(today, -1), today, horizon)).toBe(false);
  });

  it("false para horizonte+1", () => {
    expect(isInWindow(addDaysIso(today, horizon + 1), today, horizon)).toBe(false);
  });
});

describe("deskState", () => {
  it("retorna free si no hay booking", () => {
    expect(deskState({ desk: { id: 1 }, bookings: [], meId: 7 })).toBe("free");
  });

  it("retorna mine si la booking es del usuario actual", () => {
    expect(
      deskState({
        desk: { id: 1 },
        bookings: [{ deskId: 1, userId: 7, type: "daily" }],
        meId: 7,
      }),
    ).toBe("mine");
  });

  it("retorna occupied si la booking es de otro user", () => {
    expect(
      deskState({
        desk: { id: 1 },
        bookings: [{ deskId: 1, userId: 99, type: "daily" }],
        meId: 7,
      }),
    ).toBe("occupied");
  });

  it("retorna fixed si la booking es type=fixed (sea de quien sea)", () => {
    expect(
      deskState({
        desk: { id: 1 },
        bookings: [{ deskId: 1, userId: 99, type: "fixed" }],
        meId: 7,
      }),
    ).toBe("fixed");
  });
});
