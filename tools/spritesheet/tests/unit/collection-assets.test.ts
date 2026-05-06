import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyAssets } from "../../src/collection-assets.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "collection-assets-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("copyAssets", () => {
  it("crea subdir y copia los PNGs", async () => {
    const inDir = join(workDir, "in");
    const outDir = join(workDir, "out");
    require("node:fs").mkdirSync(inDir);
    require("node:fs").mkdirSync(outDir);
    writeFileSync(join(inDir, "a.png"), "AAA");
    writeFileSync(join(inDir, "b.png"), "BBB");

    const map = await copyAssets([join(inDir, "a.png"), join(inDir, "b.png")], outDir, "out_assets");

    expect(existsSync(join(outDir, "out_assets/a.png"))).toBe(true);
    expect(existsSync(join(outDir, "out_assets/b.png"))).toBe(true);
    expect(readFileSync(join(outDir, "out_assets/a.png"), "utf8")).toBe("AAA");
    expect(map.get(join(inDir, "a.png"))).toBe("out_assets/a.png");
  });

  it("idempotente (re-llamada no falla)", async () => {
    const inDir = join(workDir, "in");
    const outDir = join(workDir, "out");
    require("node:fs").mkdirSync(inDir);
    require("node:fs").mkdirSync(outDir);
    writeFileSync(join(inDir, "a.png"), "AAA");

    await copyAssets([join(inDir, "a.png")], outDir, "out_assets");
    await copyAssets([join(inDir, "a.png")], outDir, "out_assets");
    expect(existsSync(join(outDir, "out_assets/a.png"))).toBe(true);
  });
});
