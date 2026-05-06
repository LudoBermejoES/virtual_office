import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listStrips, validateStrip } from "../../src/strips.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "spritesheet-strips-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("listStrips", () => {
  it("lista solo .png en orden alfabético", () => {
    writeFileSync(join(workDir, "b.png"), "");
    writeFileSync(join(workDir, "a.png"), "");
    writeFileSync(join(workDir, "readme.md"), "");
    writeFileSync(join(workDir, "c.txt"), "");
    const strips = listStrips(workDir);
    expect(strips.map((p) => p.split("/").pop())).toEqual(["a.png", "b.png"]);
  });

  it("recursive recorre subdirectorios", () => {
    writeFileSync(join(workDir, "a.png"), "");
    mkdirSync(join(workDir, "sub"));
    writeFileSync(join(workDir, "sub", "b.png"), "");
    expect(listStrips(workDir, false)).toHaveLength(1);
    expect(listStrips(workDir, true)).toHaveLength(2);
  });

  it("array vacío si no hay PNGs", () => {
    writeFileSync(join(workDir, "x.txt"), "");
    expect(listStrips(workDir)).toEqual([]);
  });

  it("directorio inexistente no lanza", () => {
    expect(listStrips("/tmp/no-existe-xyz-123")).toEqual([]);
  });
});

describe("validateStrip", () => {
  it("acepta strip válida", () => {
    expect(validateStrip({ width: 144, height: 48 }, 48)).toEqual({ ok: true });
  });

  it("rechaza height no múltiplo del tile", () => {
    const r = validateStrip({ width: 96, height: 64 }, 48);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/strip_height_not_multiple_of_tile/);
  });

  it("acepta height múltiplo (grid 2D)", () => {
    expect(validateStrip({ width: 96, height: 96 }, 48)).toEqual({ ok: true });
    expect(validateStrip({ width: 96, height: 144 }, 48)).toEqual({ ok: true });
  });

  it("rechaza ancho no múltiplo", () => {
    const r = validateStrip({ width: 100, height: 48 }, 48);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/strip_width_not_multiple_of_tile/);
  });
});
