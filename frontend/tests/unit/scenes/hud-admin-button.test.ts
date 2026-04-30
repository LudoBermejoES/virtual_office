import { describe, it, expect, vi, beforeEach } from "vitest";
import { officesStore } from "../../../src/state/offices.js";

vi.mock("phaser", () => {
  class Scene {
    _shutdownCb: (() => void) | null = null;
    events = {
      once: (_e: string, cb: () => void) => { this._shutdownCb = cb; },
    };
    scale = { width: 800 };
    add = {
      text: () => ({
        setOrigin() { return this; }, setScrollFactor() { return this; },
        setInteractive() { return this; }, setColor() { return this; },
        setText() { return this; }, setVisible() { return this; }, on() { return this; },
      }),
      nineslice: () => ({
        setOrigin() { return this; }, setInteractive() { return this; },
        setScrollFactor() { return this; }, setVisible() { return this; }, on() { return this; },
      }),
    };
    input = { keyboard: { on: () => {} } };
    scene = { manager: { getScene: () => null }, stop: () => {}, start: () => {} };
    constructor(_cfg?: unknown) {}
  }
  return {
    default: { Scene, Scenes: { Events: { SHUTDOWN: "shutdown" } } },
    Scene,
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
  };
});

vi.mock("../../../src/state/ui.js", () => ({
  uiStore: {
    getState: () => ({
      selectedDate: "2026-01-01",
      today: "2026-01-01",
      canPrev: () => false,
      canNext: () => false,
    }),
    subscribe: () => () => {},
  },
}));

vi.mock("../../../src/ui/sound.js", () => ({
  soundManager: { isMuted: () => false, toggle: () => {}, play: () => {} },
}));

vi.mock("../../../src/ui/office-selector.js", () => ({
  mountOfficeSelector: () => {},
}));

vi.mock("../../../src/ui/admin-panel.js", () => ({
  mountAdminPanel: vi.fn(),
  unmountAdminPanel: vi.fn(),
  setEditDesksCallback: vi.fn(),
}));

vi.mock("@virtual-office/shared", () => ({
  formatLong: (_d: string, _l: string) => "01 enero 2026",
}));

vi.mock("../../../src/config.js", () => ({ BASE_URL: "" }));

function makeDoc() {
  const appended: { id: string; removed: boolean; _handlers: Record<string, (() => void)[]> }[] = [];
  return {
    createElement: (_tag: string) => {
      const el = {
        id: "",
        style: {} as Record<string, string>,
        textContent: "",
        removed: false,
        _handlers: {} as Record<string, (() => void)[]>,
        addEventListener(event: string, fn: () => void) {
          this._handlers[event] = this._handlers[event] ?? [];
          this._handlers[event].push(fn);
        },
        remove() { this.removed = true; },
      };
      appended.push(el);
      return el;
    },
    body: { appendChild: (_el: unknown) => {} },
    appended,
  };
}

describe("HUDScene — botón admin", async () => {
  const { HUDScene } = await import("../../../src/scenes/HUDScene.js");

  beforeEach(() => {
    officesStore.setState({ list: [], meId: 1, meRole: "member" });
  });

  it("monta botón ⚙ cuando meRole es admin", () => {
    officesStore.setState({ list: [], meId: 1, meRole: "admin" });
    const hud = new HUDScene();
    hud._document = makeDoc() as unknown as typeof document;
    hud.create();

    expect(hud.adminBtnEl).not.toBeNull();
    expect(hud.adminBtnEl?.id).toBe("hud-admin-btn");

    (hud as unknown as { _shutdownCb: () => void })._shutdownCb?.();
  });

  it("no monta botón ⚙ cuando meRole es member", () => {
    const hud = new HUDScene();
    hud._document = makeDoc() as unknown as typeof document;
    hud.create();

    expect(hud.adminBtnEl).toBeNull();

    (hud as unknown as { _shutdownCb: () => void })._shutdownCb?.();
  });

  it("el botón ⚙ se elimina al hacer SHUTDOWN", () => {
    officesStore.setState({ list: [], meId: 1, meRole: "admin" });
    const hud = new HUDScene();
    hud._document = makeDoc() as unknown as typeof document;
    hud.create();

    const btn = hud.adminBtnEl as unknown as { removed: boolean };
    expect(btn).not.toBeNull();

    (hud as unknown as { _shutdownCb: () => void })._shutdownCb?.();

    expect(btn.removed).toBe(true);
    expect(hud.adminBtnEl).toBeNull();
  });
});
