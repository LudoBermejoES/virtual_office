import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { runPipeline } from "../../src/pipeline.js";
import { parseTmj } from "../../src/tmj.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "tmj-opt-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

async function writeTilesetPng(path: string, cols: number, rows: number, tile: number): Promise<void> {
  const buf = await sharp({
    create: {
      width: cols * tile,
      height: rows * tile,
      channels: 4,
      background: { r: 0, g: 200, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  writeFileSync(path, buf);
}

describe("runPipeline e2e", () => {
  it("genera TMJ + WebP en disco con dimensiones esperadas", async () => {
    const tile = 16;
    await writeTilesetPng(join(workDir, "ts.png"), 4, 4, tile);

    const tmj = {
      type: "map",
      orientation: "orthogonal",
      width: 2,
      height: 2,
      tilewidth: tile,
      tileheight: tile,
      infinite: false,
      tilesets: [
        {
          firstgid: 1,
          name: "ts",
          image: "ts.png",
          imagewidth: 4 * tile,
          imageheight: 4 * tile,
          tilewidth: tile,
          tileheight: tile,
          tilecount: 16,
          columns: 4,
          margin: 0,
          spacing: 0,
        },
      ],
      layers: [
        {
          type: "tilelayer",
          name: "L",
          width: 2,
          height: 2,
          data: [1, 5, 0, 10],
        },
      ],
    };
    writeFileSync(join(workDir, "in.tmj"), JSON.stringify(tmj));

    const report = await runPipeline({
      input: join(workDir, "in.tmj"),
      padding: 0,
      lossless: true,
      quality: 90,
    });

    expect(report.totalSourceTiles).toBe(16);
    expect(report.usedTiles).toBe(3);
    expect(existsSync(report.outputTmjPath)).toBe(true);
    expect(existsSync(report.outputWebpPath)).toBe(true);

    // El TMJ output vuelve a parsear
    const outRaw = JSON.parse(readFileSync(report.outputTmjPath, "utf8"));
    const outTmj = parseTmj(outRaw);
    expect(outTmj.tilesets).toHaveLength(1);

    // El WebP existe y es válido
    const meta = await sharp(report.outputWebpPath).metadata();
    expect(meta.format).toBe("webp");
    // 3 tiles → cols=2, rows=2 → 32×32
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });

  it("--out-dir crea el directorio si no existe", async () => {
    const tile = 16;
    await writeTilesetPng(join(workDir, "ts.png"), 2, 2, tile);
    const tmj = {
      type: "map",
      orientation: "orthogonal",
      width: 1,
      height: 1,
      tilewidth: tile,
      tileheight: tile,
      tilesets: [
        {
          firstgid: 1,
          name: "ts",
          image: "ts.png",
          imagewidth: 2 * tile,
          imageheight: 2 * tile,
          tilewidth: tile,
          tileheight: tile,
          tilecount: 4,
          columns: 2,
        },
      ],
      layers: [{ type: "tilelayer", name: "L", width: 1, height: 1, data: [1] }],
    };
    writeFileSync(join(workDir, "in.tmj"), JSON.stringify(tmj));
    const out = join(workDir, "nested", "out");

    const report = await runPipeline({
      input: join(workDir, "in.tmj"),
      outDir: out,
      padding: 0,
      lossless: true,
      quality: 90,
    });

    expect(existsSync(report.outputTmjPath)).toBe(true);
    expect(report.outputTmjPath.startsWith(out)).toBe(true);
  });
});
