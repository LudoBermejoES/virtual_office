import { describe, it, expect } from "vitest";
import { THEME } from "../../../src/render/theme.js";

describe("THEME", () => {
  it("exporta bg", () => {
    expect(THEME.bg).toBe(0x0b0d1a);
  });

  it("exporta fg", () => {
    expect(THEME.fg).toBe(0xf5f5f5);
  });

  it("exporta free", () => {
    expect(THEME.free).toBe(0x36e36c);
  });

  it("exporta occupied", () => {
    expect(THEME.occupied).toBe(0xff4d6d);
  });

  it("exporta mine", () => {
    expect(THEME.mine).toBe(0x5cf6ff);
  });

  it("exporta fixed", () => {
    expect(THEME.fixed).toBe(0xb66dff);
  });

  it("exporta accent", () => {
    expect(THEME.accent).toBe(0xff66cc);
  });

  it("exporta warning", () => {
    expect(THEME.warning).toBe(0xffd166);
  });
});
