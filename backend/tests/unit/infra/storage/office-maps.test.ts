import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeTilesetFilename,
  computeTmjFilename,
  serveSafe,
  saveBundle,
} from "../../../../src/infra/storage/office-maps.js";

describe("computeTilesetFilename", () => {
  it("retorna tile_{ordinal}_{sha[:12]}.{ext}", () => {
    expect(computeTilesetFilename(0, "abcdef0123456789xx", "png")).toBe("tile_0_abcdef012345.png");
    expect(computeTilesetFilename(2, "abcdef0123456789xx", "webp")).toBe(
      "tile_2_abcdef012345.webp",
    );
  });
});

describe("serveSafe", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "vo-maps-"));
    mkdirSync(join(baseDir, "1"), { recursive: true });
    writeFileSync(join(baseDir, "1", "map_abc123def456.tmj"), "{}");
    writeFileSync(join(baseDir, "1", "tile_0_abc123def456.png"), Buffer.from([0]));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("acepta un filename válido y existente", () => {
    const r = serveSafe(baseDir, 1, "map_abc123def456.tmj");
    expect(r.ok).toBe(true);
  });

  it("rechaza path traversal", () => {
    const r = serveSafe(baseDir, 1, "../../etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_filename");
  });

  it("rechaza extensión inválida", () => {
    const r = serveSafe(baseDir, 1, "foo.exe");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_filename");
  });

  it("retorna not_found si el filename es válido pero no existe", () => {
    const r = serveSafe(baseDir, 1, "tile_99_xxxxxxxxxxxx.png");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });
});

describe("saveBundle", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "vo-maps-save-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("crea OFFICE_MAPS_DIR/{officeId}/ con tmj y tilesets", () => {
    const tmjBuf = Buffer.from('{"hello":"world"}');
    const tilesetBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const r = saveBundle({
      baseDir,
      officeId: 7,
      tmj: { buffer: tmjBuf, image_filenames: ["a.png"] },
      tilesets: [{ buffer: tilesetBuf, image_name: "a.png", mime_type: "image/png" }],
    });
    expect(r.tmjFilename).toMatch(/^map_[a-f0-9]{12}\.tmj$/);
    expect(r.tilesets).toHaveLength(1);
    expect(r.tilesets[0]?.filename).toMatch(/^tile_0_[a-f0-9]{12}\.png$/);
    expect(r.tilesets[0]?.image_name).toBe("a.png");
  });

  it("usa el hash del fichero — subir el mismo bundle dos veces produce los mismos filenames", () => {
    const tmjBuf = Buffer.from('{"hello":"world"}');
    const tilesetBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const first = saveBundle({
      baseDir,
      officeId: 1,
      tmj: { buffer: tmjBuf, image_filenames: ["a.png"] },
      tilesets: [{ buffer: tilesetBuf, image_name: "a.png", mime_type: "image/png" }],
    });
    const second = saveBundle({
      baseDir,
      officeId: 2,
      tmj: { buffer: tmjBuf, image_filenames: ["a.png"] },
      tilesets: [{ buffer: tilesetBuf, image_name: "a.png", mime_type: "image/png" }],
    });
    expect(first.tmjFilename).toBe(second.tmjFilename);
    expect(first.tilesets[0]?.filename).toBe(second.tilesets[0]?.filename);
  });

  it(computeTmjFilename.name + " hash es estable", () => {
    expect(computeTmjFilename(Buffer.from("abc"))).toBe(computeTmjFilename(Buffer.from("abc")));
    expect(computeTmjFilename(Buffer.from("abc"))).not.toBe(
      computeTmjFilename(Buffer.from("abcd")),
    );
  });
});
