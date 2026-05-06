import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { runPipeline } from "../../src/pipeline.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "spritesheet-pipeline-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

async function writeStrip(
  path: string,
  frameCount: number,
  tile: number,
  color = { r: 100, g: 200, b: 100, alpha: 1 },
): Promise<void> {
  const buf = await sharp({
    create: {
      width: frameCount * tile,
      height: tile,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
  writeFileSync(path, buf);
}

describe("runPipeline e2e", () => {
  it("genera spritesheet PNG y .tsx con animaciones", async () => {
    const tile = 48;
    await writeStrip(join(workDir, "a.png"), 2, tile);
    await writeStrip(join(workDir, "b.png"), 3, tile);
    await writeStrip(join(workDir, "c.png"), 1, tile);

    const outputImage = join(workDir, "sheet.png");
    const report = await runPipeline({
      inputDir: workDir,
      outputImage,
      tile,
      duration: 200,
      webp: false,
      recursive: false,
    });

    expect(report.pngCount).toBe(3);
    expect(report.framesTotal).toBe(6);
    expect(report.animations).toBe(2);
    expect(report.staticTiles).toBe(1);
    expect(existsSync(report.outputImagePath)).toBe(true);
    expect(existsSync(report.outputTsxPath)).toBe(true);

    // dimensiones del spritesheet: cols=3, rows=3, 144x144
    const meta = await sharp(report.outputImagePath).metadata();
    expect(meta.width).toBe(144);
    expect(meta.height).toBe(144);
    expect(meta.format).toBe("png");

    const tsx = readFileSync(report.outputTsxPath, "utf8");
    expect(tsx).toMatch(/<animation>/);
    expect(tsx).toMatch(/<property name="name" value="a"\/>/);
    expect(tsx).toMatch(/<property name="name" value="c"\/>/);
  });

  it("--webp produce WebP", async () => {
    const tile = 48;
    await writeStrip(join(workDir, "a.png"), 2, tile);

    const outputImage = join(workDir, "sheet.png");
    const report = await runPipeline({
      inputDir: workDir,
      outputImage,
      tile,
      duration: 200,
      webp: true,
      recursive: false,
    });
    // Debería haber escrito sheet.webp en lugar de sheet.png
    expect(report.outputImagePath.endsWith(".webp")).toBe(true);
    const meta = await sharp(report.outputImagePath).metadata();
    expect(meta.format).toBe("webp");
  });

  it("rechaza directorio vacío", async () => {
    await expect(
      runPipeline({
        inputDir: workDir,
        outputImage: join(workDir, "sheet.png"),
        tile: 48,
        duration: 200,
        webp: false,
        recursive: false,
      }),
    ).rejects.toThrow(/empty_directory/);
  });

  it("rechaza strip con altura no múltiplo del tile", async () => {
    const buf = await sharp({
      create: { width: 96, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    writeFileSync(join(workDir, "bad.png"), buf);

    await expect(
      runPipeline({
        inputDir: workDir,
        outputImage: join(workDir, "sheet.png"),
        tile: 48,
        duration: 200,
        webp: false,
        recursive: false,
      }),
    ).rejects.toThrow(/strip_height_not_multiple_of_tile/);
  });

  it("PNG con grid 2D produce N strips (una por fila)", async () => {
    const tile = 48;
    // PNG de 144x96 = 3 cols × 2 rows
    const buf = await sharp({
      create: { width: 144, height: 96, channels: 4, background: { r: 0, g: 100, b: 200, alpha: 1 } },
    })
      .png()
      .toBuffer();
    writeFileSync(join(workDir, "grid.png"), buf);

    const report = await runPipeline({
      inputDir: workDir,
      outputImage: join(workDir, "sheet.png"),
      tile,
      duration: 200,
      webp: false,
      recursive: false,
    });

    expect(report.pngCount).toBe(1);
    expect(report.rowCount).toBe(2);
    expect(report.framesTotal).toBe(6);
    expect(report.animations).toBe(2);

    const tsx = readFileSync(report.outputTsxPath, "utf8");
    expect(tsx).toMatch(/<property name="name" value="grid__row0"\/>/);
    expect(tsx).toMatch(/<property name="name" value="grid__row1"\/>/);
  });
});
