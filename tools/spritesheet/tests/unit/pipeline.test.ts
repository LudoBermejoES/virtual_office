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

async function writePng(
  path: string,
  width: number,
  height: number,
  color = { r: 100, g: 200, b: 100, alpha: 1 },
): Promise<void> {
  const buf = await sharp({
    create: { width, height, channels: 4, background: color },
  })
    .png()
    .toBuffer();
  writeFileSync(path, buf);
}

describe("runPipeline e2e — modo atlas", () => {
  it("genera spritesheet PNG y .tsx con animaciones", async () => {
    const tile = 48;
    await writePng(join(workDir, "a.png"), 2 * tile, tile);
    await writePng(join(workDir, "b.png"), 3 * tile, tile);
    await writePng(join(workDir, "c.png"), tile, tile);

    const outputImage = join(workDir, "sheet.png");
    const report = await runPipeline({
      inputDir: workDir,
      output: outputImage,
      tile,
      duration: 200,
      webp: false,
      recursive: false,
    });

    expect(report.mode).toBe("atlas");
    expect(report.pngCount).toBe(3);
    expect(report.framesTotal).toBe(6);
    expect(report.animations).toBe(2);
    expect(report.staticTiles).toBe(1);
    expect(report.outputImagePath).toBeDefined();
    expect(existsSync(report.outputImagePath!)).toBe(true);
    expect(existsSync(report.outputTsxPath)).toBe(true);

    const meta = await sharp(report.outputImagePath!).metadata();
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
    await writePng(join(workDir, "a.png"), 2 * tile, tile);

    const outputImage = join(workDir, "sheet.png");
    const report = await runPipeline({
      inputDir: workDir,
      output: outputImage,
      tile,
      duration: 200,
      webp: true,
      recursive: false,
    });
    expect(report.outputImagePath).toBeDefined();
    expect(report.outputImagePath!.endsWith(".webp")).toBe(true);
    const meta = await sharp(report.outputImagePath!).metadata();
    expect(meta.format).toBe("webp");
  });

  it("rechaza directorio vacío", async () => {
    await expect(
      runPipeline({
        inputDir: workDir,
        output: join(workDir, "sheet.png"),
        tile: 48,
        duration: 200,
        webp: false,
        recursive: false,
      }),
    ).rejects.toThrow(/empty_directory/);
  });

  it("PNG con grid 2D produce N strips (una por fila)", async () => {
    const tile = 48;
    await writePng(join(workDir, "grid.png"), 144, 96);

    const report = await runPipeline({
      inputDir: workDir,
      output: join(workDir, "sheet.png"),
      tile,
      duration: 200,
      webp: false,
      recursive: false,
    });

    expect(report.mode).toBe("atlas");
    expect(report.pngCount).toBe(1);
    expect(report.tileCount).toBe(2);
    expect(report.framesTotal).toBe(6);
    expect(report.animations).toBe(2);

    const tsx = readFileSync(report.outputTsxPath, "utf8");
    expect(tsx).toMatch(/<property name="name" value="grid__row0"\/>/);
    expect(tsx).toMatch(/<property name="name" value="grid__row1"\/>/);
  });
});

describe("runPipeline e2e — modo collection", () => {
  it("autodetecta collection con tamaños mezclados (manifest)", async () => {
    await writePng(join(workDir, "small.png"), 96, 48); // 2 frames de 48x48
    await writePng(join(workDir, "cat.png"), 1728, 48); // 12 frames de 144x48

    writeFileSync(
      join(workDir, "frame_sizes.json"),
      JSON.stringify({
        "cat.png": { frame_width: 144, frame_height: 48 },
      }),
    );

    const report = await runPipeline({
      inputDir: workDir,
      output: join(workDir, "out"),
      tile: 48,
      duration: 100,
      webp: false,
      recursive: false,
    });

    expect(report.mode).toBe("collection");
    expect(report.pngCount).toBe(2);
    expect(report.outputImagePath).toBeUndefined();
    expect(report.assetsDir).toBeDefined();
    expect(existsSync(join(report.assetsDir!, "cat.png"))).toBe(true);
    expect(existsSync(join(report.assetsDir!, "small.png"))).toBe(true);
    expect(existsSync(report.outputTsxPath)).toBe(true);

    const tsx = readFileSync(report.outputTsxPath, "utf8");
    expect(tsx).toMatch(/columns="0"/);
    expect(tsx).toMatch(/<grid orientation="orthogonal"/);
    expect(tsx).toMatch(/<property name="name" value="cat"\/>/);
    expect(tsx).toMatch(/<property name="frame_width" type="int" value="144"\/>/);
    expect(tsx).toMatch(/<property name="frame_count" type="int" value="12"\/>/);
  });

  it("--collection fuerza el modo aunque tamaños sean iguales", async () => {
    await writePng(join(workDir, "a.png"), 96, 48);
    await writePng(join(workDir, "b.png"), 96, 48);

    const report = await runPipeline({
      inputDir: workDir,
      output: join(workDir, "out.tsx"),
      tile: 48,
      duration: 200,
      webp: false,
      recursive: false,
      forceMode: "collection",
    });
    expect(report.mode).toBe("collection");
    expect(report.assetsDir).toBeDefined();
  });

  it("--atlas con tamaños mezclados → error", async () => {
    await writePng(join(workDir, "small.png"), 96, 48);
    await writePng(join(workDir, "cat.png"), 1728, 48);
    writeFileSync(
      join(workDir, "frame_sizes.json"),
      JSON.stringify({ "cat.png": { frame_width: 144, frame_height: 48 } }),
    );

    await expect(
      runPipeline({
        inputDir: workDir,
        output: join(workDir, "sheet.png"),
        tile: 48,
        duration: 200,
        webp: false,
        recursive: false,
        forceMode: "atlas",
      }),
    ).rejects.toThrow(/atlas_mode_with_mixed_sizes/);
  });
});
