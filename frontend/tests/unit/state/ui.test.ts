import { describe, it, expect, beforeEach } from "vitest";
import { uiStore, shouldApply } from "../../../src/state/ui.js";
import { addDays } from "@virtual-office/shared";
import type { WsServerMessage } from "@virtual-office/shared";

beforeEach(() => {
  // limpia el store y el sessionStorage
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
});

describe("uiStore.setDate", () => {
  it("setDate dentro del horizonte actualiza", () => {
    const tgt = addDays(uiStore.getState().today, 5);
    expect(uiStore.getState().setDate(tgt)).toBe(true);
    expect(uiStore.getState().selectedDate).toBe(tgt);
  });

  it("setDate fuera del horizonte hacia adelante rechaza", () => {
    const tgt = addDays(uiStore.getState().today, 999);
    expect(uiStore.getState().setDate(tgt)).toBe(false);
  });

  it("setDate fuera del horizonte hacia atrás rechaza", () => {
    const tgt = addDays(uiStore.getState().today, -999);
    expect(uiStore.getState().setDate(tgt)).toBe(false);
  });

  it("next avanza un día; prev retrocede un día", () => {
    const today = uiStore.getState().today;
    uiStore.getState().setDate(today);
    uiStore.getState().next();
    expect(uiStore.getState().selectedDate).toBe(addDays(today, 1));
    uiStore.getState().prev();
    expect(uiStore.getState().selectedDate).toBe(today);
  });

  it("resetToToday vuelve al día actual", () => {
    const today = uiStore.getState().today;
    uiStore.getState().setDate(addDays(today, 7));
    uiStore.getState().resetToToday();
    expect(uiStore.getState().selectedDate).toBe(today);
  });

  it("canNext es false en el límite del horizonte", () => {
    const today = uiStore.getState().today;
    uiStore.getState().setDate(addDays(today, 59));
    expect(uiStore.getState().canNext()).toBe(false);
  });

  it("canPrev es false en el límite hacia atrás", () => {
    const today = uiStore.getState().today;
    uiStore.getState().setDate(addDays(today, -30));
    expect(uiStore.getState().canPrev()).toBe(false);
  });
});

describe("shouldApply", () => {
  it("desk.booked en otra fecha → false", () => {
    const msg: WsServerMessage = {
      type: "desk.booked",
      deskId: 1,
      date: "2026-06-01",
      user: { id: 1, name: "X", avatar_url: null },
    };
    expect(shouldApply(msg, "2026-05-04")).toBe(false);
  });

  it("desk.booked en la misma fecha → true", () => {
    const msg: WsServerMessage = {
      type: "desk.booked",
      deskId: 1,
      date: "2026-05-04",
      user: { id: 1, name: "X", avatar_url: null },
    };
    expect(shouldApply(msg, "2026-05-04")).toBe(true);
  });

  it("desk.released en otra fecha → false", () => {
    const msg: WsServerMessage = {
      type: "desk.released",
      deskId: 1,
      date: "2026-06-01",
    };
    expect(shouldApply(msg, "2026-05-04")).toBe(false);
  });

  it("desk.fixed → true (siempre aplica)", () => {
    const msg: WsServerMessage = {
      type: "desk.fixed",
      deskId: 1,
      user: { id: 1, name: "X", avatar_url: null },
    };
    expect(shouldApply(msg, "2026-05-04")).toBe(true);
  });

  it("office.updated → true", () => {
    expect(shouldApply({ type: "office.updated", officeId: 1 }, "2026-05-04")).toBe(true);
  });
});
