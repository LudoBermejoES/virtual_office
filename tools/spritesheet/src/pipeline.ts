import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import sharp from "sharp";
import { listStrips, type Strip } from "./strips.js";
import { computeLayout } from "./layout.js";
import { composeSheet } from "./compose.js";
import { buildTsxXml } from "./tsx.js";
import { loadFrameSizesManifest, type FrameSizesManifest } from "./frame-sizes.js";
import {
  detectMode,
  effectiveFrameSize,
  type EffectiveSize,
  type Mode,
  type PngInfo,
} from "./mode-detection.js";
import { buildImageCollectionTsx, type CollectionTile } from "./collection-tsx.js";
import { copyAssets } from "./collection-assets.js";

export interface PipelineOptions {
  inputDir: string;
  output: string;
  tile: number;
  duration: number;
  webp: boolean;
  recursive: boolean;
  skipInvalid?: boolean;
  /** "atlas" | "collection" para forzar; undefined = autodetect. */
  forceMode?: Mode;
  /** Path explícito a manifest. Si no se da, busca <inputDir>/frame_sizes.json. */
  frameSizesPath?: string;
}

export interface SkipReport {
  filename: string;
  reason: string;
}

export interface PipelineReport {
  mode: Mode;
  pngCount: number;
  tileCount: number;
  framesTotal: number;
  animations: number;
  staticTiles: number;
  outputImagePath?: string;
  outputTsxPath: string;
  assetsDir?: string;
  outputBytes: number;
  skipped: SkipReport[];
}

interface PngLoaded {
  path: string;
  info: PngInfo;
  buffer: Buffer;
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineReport> {
  const cwd = process.env["INIT_CWD"] ?? process.cwd();
  const inputDir = resolve(cwd, options.inputDir);
  const outputPath = resolve(cwd, options.output);
  const outputDir = dirname(outputPath);
  const baseName = basename(outputPath, extname(outputPath));

  const paths = listStrips(inputDir, options.recursive);
  if (paths.length === 0) {
    throw new Error(`empty_directory: no se encontraron PNGs en ${inputDir}`);
  }

  // Cargar manifest opcional
  const manifestPath = options.frameSizesPath
    ? resolve(cwd, options.frameSizesPath)
    : join(inputDir, "frame_sizes.json");
  const manifest: FrameSizesManifest = loadFrameSizesManifest(manifestPath);

  // Cargar PNGs y calcular sizes efectivos
  const loaded: PngLoaded[] = [];
  const sizes: EffectiveSize[] = [];
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
    const info: PngInfo = { filename: basename(path), width: meta.width, height: meta.height };
    let size: EffectiveSize;
    try {
      size = effectiveFrameSize(info, manifest);
    } catch (e) {
      if (options.skipInvalid) {
        skipped.push({ filename: info.filename, reason: (e as Error).message });
        continue;
      }
      throw e;
    }
    loaded.push({ path, info, buffer: buf });
    sizes.push(size);
  }

  if (sizes.length === 0) {
    throw new Error("no_valid_pngs");
  }

  // Decidir modo
  const detected = detectMode(sizes);
  const mode: Mode = options.forceMode ?? detected;

  if (options.forceMode === "atlas" && detected === "collection") {
    throw new Error(
      "atlas_mode_with_mixed_sizes: tamaños mezclados detectados; usa --collection o omite --atlas",
    );
  }

  await mkdir(outputDir, { recursive: true });

  if (mode === "atlas") {
    return runAtlas({
      sizes,
      loaded,
      outputDir,
      baseName,
      options,
      skipped,
    });
  }
  return runCollection({
    sizes,
    loaded,
    outputDir,
    baseName,
    options,
    skipped,
  });
}

interface RunArgs {
  sizes: EffectiveSize[];
  loaded: PngLoaded[];
  outputDir: string;
  baseName: string;
  options: PipelineOptions;
  skipped: SkipReport[];
}

async function runAtlas(args: RunArgs): Promise<PipelineReport> {
  const { sizes, loaded, outputDir, baseName, options, skipped } = args;
  const tile = sizes[0]!.frame_width;

  const strips: Strip[] = [];
  const stripBuffers: Buffer[] = [];
  for (let i = 0; i < loaded.length; i++) {
    const { path, info, buffer } = loaded[i]!;
    const size = sizes[i]!;
    const ext = extname(path);
    const baseNoExt = basename(path, ext);
    for (let row = 0; row < size.row_count; row++) {
      const stripFilename =
        size.row_count === 1 ? `${baseNoExt}${ext}` : `${baseNoExt}__row${row}${ext}`;
      strips.push({
        filename: stripFilename,
        fullPath: path,
        width: info.width,
        frameCount: size.frame_count,
        sourceRow: row,
      });
      const rowBuf = await sharp(buffer, { limitInputPixels: false })
        .extract({ left: 0, top: row * tile, width: info.width, height: tile })
        .png()
        .toBuffer();
      stripBuffers.push(rowBuf);
    }
  }

  const layout = computeLayout(strips, tile);
  const sheetBuffer = await composeSheet(layout, stripBuffers, { webp: options.webp });

  const ext = options.webp ? ".webp" : ".png";
  const finalImagePath = join(outputDir, `${baseName}${ext}`);
  const outputTsxPath = join(outputDir, `${baseName}.tsx`);
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
    mode: "atlas",
    pngCount: loaded.length,
    tileCount: strips.length,
    framesTotal,
    animations,
    staticTiles,
    outputImagePath: finalImagePath,
    outputTsxPath,
    outputBytes: sheetBuffer.byteLength,
    skipped,
  };
}

async function runCollection(args: RunArgs): Promise<PipelineReport> {
  const { sizes, loaded, outputDir, baseName, options, skipped } = args;
  const assetsSubdir = `${baseName}_assets`;

  // Copiar PNGs a la subcarpeta
  const assetMap = await copyAssets(
    loaded.map((l) => l.path),
    outputDir,
    assetsSubdir,
  );

  // Construir tiles (uno por (PNG × fila))
  const tiles: CollectionTile[] = [];
  for (let i = 0; i < loaded.length; i++) {
    const { path } = loaded[i]!;
    const size = sizes[i]!;
    const relPath = assetMap.get(path)!;
    for (let row = 0; row < size.row_count; row++) {
      tiles.push({ size, rowIndex: row, imageRelPath: relPath });
    }
  }

  const tsx = buildImageCollectionTsx(tiles, {
    tilesetName: baseName,
    duration: options.duration,
  });
  const outputTsxPath = join(outputDir, `${baseName}.tsx`);
  await writeFile(outputTsxPath, tsx);

  const animations = tiles.filter((t) => t.size.frame_count > 1).length;
  const staticTiles = tiles.length - animations;
  const framesTotal = tiles.reduce((sum, t) => sum + t.size.frame_count, 0);

  // En collection no hay un único output image; reportamos bytes del .tsx
  const tsxBytes = Buffer.byteLength(tsx, "utf8");

  return {
    mode: "collection",
    pngCount: loaded.length,
    tileCount: tiles.length,
    framesTotal,
    animations,
    staticTiles,
    outputTsxPath,
    assetsDir: join(outputDir, assetsSubdir),
    outputBytes: tsxBytes,
    skipped,
  };
}
