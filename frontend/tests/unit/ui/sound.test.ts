import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
});

describe("SoundManager", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.resetModules();
  });

  it("muted por defecto cuando no hay localStorage", async () => {
    const { soundManager } = await import("../../../src/ui/sound.js");
    expect(soundManager.isMuted()).toBe(true);
  });

  it("toggle alterna de muted a unmuted", async () => {
    const { soundManager } = await import("../../../src/ui/sound.js");
    expect(soundManager.isMuted()).toBe(true);
    soundManager.toggle();
    expect(soundManager.isMuted()).toBe(false);
    soundManager.toggle();
    expect(soundManager.isMuted()).toBe(true);
  });

  it("toggle persiste en localStorage", async () => {
    const { soundManager } = await import("../../../src/ui/sound.js");
    soundManager.toggle(); // ahora unmuted
    expect(store["vo_sound_muted"]).toBe("false");
    soundManager.toggle(); // vuelve a muted
    expect(store["vo_sound_muted"]).toBe("true");
  });

  it("recupera estado muted=false de localStorage", async () => {
    store["vo_sound_muted"] = "false";
    const { soundManager } = await import("../../../src/ui/sound.js");
    expect(soundManager.isMuted()).toBe(false);
  });
});
