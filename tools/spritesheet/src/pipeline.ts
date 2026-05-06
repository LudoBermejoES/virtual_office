import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import sharp from "sharp";
import { listStrips, validateStrip, type Strip } from "./strips.js";
import { computeLayout } from "./layout.js";
import { composeSheet } from "./compose.js";
import { buildTsxXml } from "./tsx.js";

export interface PipelineOptions {
  inputDir: string;
  outputImage: string;
  tile: number;
  duration: number;
  webp: boolean;
  recursive: boolean;
  /** Si true, los PNGs que no validan se saltan con warning. Si false, error fatal. */
  skipInvalid?: boolean;
}

export interface SkipReport {
  filename: string;
  reason: string;
}

export interface PipelineReport {
  pngCount: number;
  rowCount: number;
  framesTotal: number;
  animations: number;
  staticTiles: number;
  outputImagePath: string;
  outputTsxPath: string;
  outputBytes: number;
  skipped: SkipReport[];
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineReport> {
  const cwd = process.env["INIT_CWD"] ?? process.cwd();
  const inputDir = resolve(cwd, options.inputDir);
  const outputImagePath = resolve(cwd, options.outputImage);
  const outputDir = dirname(outputImagePath);
  const ext = options.webp ? ".webp" : extname(outputImagePath) || ".png";
  const baseName = basename(outputImagePath, extname(outputImagePath));
  const finalImagePath = join(outputDir, `${baseName}${ext}`);
  const outputTsxPath = join(outputDir, `${baseName}.tsx`);

  const paths = listStrips(inputDir, options.recursive);
  if (paths.length === 0) {
    throw new Error(`empty_directory: no se encontraron PNGs en ${inputDir}`);
  }

  const strips: Strip[] = [];
  const stripBuffers: Buffer[] = [];
  const skipped: SkipReport[] = [];
  for (const path of paths) {
    const buf = await readFile(path);
    const meta = await sharp(buf, { limitInputPixels: false }).metadata();
    if (typeof meta.width !== "number" || typeof meta.height !== "number") {
      if (options.skipInvalid) {
        skipped.push({ filename: basename(path), reason: "unreadable_image" });
        continue;
      }
      throw new Error(`unreadable_image: ${path}`);
    }
    const v = validateStrip({ width: meta.width, height: meta.height }, options.tile);
    if (!v.ok) {
      if (options.skipInvalid) {
        skipped.push({ filename: basename(path), reason: v.reason ?? "invalid" });
        continue;
      }
      throw new Error(`${basename(path)}: ${v.reason}`);
    }
    const frameCount = meta.width / options.tile;
    const sourceRows = meta.height / options.tile;
    const ext = extname(path);
    const baseNameNoExt = basename(path, ext);

    for (let row = 0; row < sourceRows; row++) {
      const stripFilename =
        sourceRows === 1 ? `${baseNameNoExt}${ext}` : `${baseNameNoExt}__row${row}${ext}`;
      strips.push({
        filename: stripFilename,
        fullPath: path,
        width: meta.width,
        frameCount,
        sourceRow: row,
      });
      // Extrae la fila correspondiente del PNG fuente
      const rowBuf = await sharp(buf, { limitInputPixels: false })
        .extract({ left: 0, top: row * options.tile, width: meta.width, height: options.tile })
        .png()
        .toBuffer();
      stripBuffers.push(rowBuf);
    }
  }

  const layout = computeLayout(strips, options.tile);
  const sheetBuffer = await composeSheet(layout, stripBuffers, { webp: options.webp });

  await mkdir(outputDir, { recursive: true });
  await writeFile(finalImagePath, sheetBuffer);

  const tsx = buildTsxXml(layout, {
    imageFilename: basename(finalImagePath),
    duration: options.duration,
    tilesetName: baseName,
  });
  await writeFile(outputTsxPath, tsx);

  const animations = strips.filter((s) => s.frameCount > 1).length;
  const staticTiles = strips.length - animations;
  const framesTotal = strips.reduce((sum, s) => sum + s.frameCount, 0);

  return {
    pngCount: paths.length,
    rowCount: strips.length,
    framesTotal,
    animations,
    staticTiles,
    outputImagePath: finalImagePath,
    outputTsxPath,
    outputBytes: sheetBuffer.byteLength,
    skipped,
  };
}
