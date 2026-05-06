import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFrameSizesManifest } from "../../src/frame-sizes.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "fs-manifest-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("loadFrameSizesManifest", () => {
  it("parsea JSON válido", () => {
    const path = join(workDir, "frame_sizes.json");
    writeFileSync(
      path,
      JSON.stringify({
        "cat.png": { frame_width: 144, frame_height: 48 },
        "butterfly.png": { frame_width: 48, frame_height: 48 },
      }),
    );
    const m = loadFrameSizesManifest(path);
    expect(m["cat.png"]).toEqual({ frame_width: 144, frame_height: 48 });
    expect(m["butterfly.png"]).toEqual({ frame_width: 48, frame_height: 48 });
  });

  it("retorna {} si el manifest no existe", () => {
    expect(loadFrameSizesManifest(join(workDir, "no-existe.json"))).toEqual({});
  });

  it("rechaza JSON inválido", () => {
    const path = join(workDir, "bad.json");
    writeFileSync(path, "{ esto no es json válido");
    expect(() => loadFrameSizesManifest(path)).toThrow(/frame_sizes_invalid_json/);
  });

  it("rechaza schema inválido (frame_width string)", () => {
    const path = join(workDir, "bad.json");
    writeFileSync(path, JSON.stringify({ "x.png": { frame_width: "abc", frame_height: 48 } }));
    expect(() => loadFrameSizesManifest(path)).toThrow(/frame_sizes_invalid_schema/);
  });

  it("rechaza dimensiones negativas o cero", () => {
    const path = join(workDir, "bad.json");
    writeFileSync(path, JSON.stringify({ "x.png": { frame_width: 0, frame_height: 48 } }));
    expect(() => loadFrameSizesManifest(path)).toThrow(/frame_sizes_invalid_schema/);
  });
});
