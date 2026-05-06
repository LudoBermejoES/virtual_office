import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve, basename, extname } from "node:path";
import sharp from "sharp";
import { parseTmj, isEmbeddedTileset, type Tmj, type TmjTilesetEmbedded } from "./tmj.js";
import { extractUsedGids, applyAnimationClosure } from "./used-gids.js";
import { buildGidMapping } from "./mapping.js";
import { composeAtlas } from "./atlas.js";
import { buildOutputTmj } from "./output-tmj.js";

export interface PipelineOptions {
  input: string;
  outDir?: string;
  padding: number;
  lossless: boolean;
  quality: number;
}

export interface PipelineReport {
  totalSourceTiles: number;
  usedTiles: number;
  reductionPercent: number;
  outputTmjPath: string;
  outputWebpPath: string;
  outputBytes: number;
  sourceArea: number;
  outputArea: number;
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineReport> {
  const cwd = process.env["INIT_CWD"] ?? process.cwd();
  const inputPath = resolve(cwd, options.input);
  const inputDir = dirname(inputPath);
  const outDir = options.outDir ? resolve(cwd, options.outDir) : inputDir;
  const baseName = basename(inputPath, extname(inputPath));
  const outputTmjPath = join(outDir, `${baseName}.optimized.tmj`);
  const outputWebpName = `${baseName}.optimized.webp`;
  const outputWebpPath = join(outDir, outputWebpName);

  const tmjRaw = await readFile(inputPath, "utf8");
  const tmj: Tmj = parseTmj(JSON.parse(tmjRaw));

  // Solo embebidos pasan parseTmj, narrow para TS.
  const inputTilesets: TmjTilesetEmbedded[] = tmj.tilesets.filter(isEmbeddedTileset);

  const totalSourceTiles = inputTilesets.reduce((sum, t) => sum + t.tilecount, 0);
  const sourceArea = inputTilesets.reduce((sum, t) => sum + t.imagewidth * t.imageheight, 0);

  const tilesetBuffers: Buffer[] = [];
  for (const ts of inputTilesets) {
    const path = resolve(inputDir, ts.image);
    const buf = await readFile(path);
    tilesetBuffers.push(buf);
  }

  const usedRaw = extractUsedGids(tmj);
  const usedClosed = applyAnimationClosure(usedRaw, inputTilesets);
  const mapping = buildGidMapping(usedClosed, inputTilesets);

  const atlas = await composeAtlas(
    inputTilesets,
    tilesetBuffers,
    mapping,
    tmj.tilewidth,
    tmj.tileheight,
    {
      padding: options.padding,
      lossless: options.lossless,
      quality: options.quality,
    },
  );

  const outputTmj = buildOutputTmj({
    input: tmj,
    inputTilesets,
    mapping,
    atlas,
    outputImageName: outputWebpName,
    padding: options.padding,
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(outputWebpPath, atlas.buffer);
  await writeFile(outputTmjPath, JSON.stringify(outputTmj, null, 2));

  // Reporte
  const meta = await sharp(atlas.buffer).metadata();
  const outputArea = (meta.width ?? atlas.width) * (meta.height ?? atlas.height);
  const reductionPercent =
    sourceArea > 0 ? Math.round((1 - outputArea / sourceArea) * 1000) / 10 : 0;

  return {
    totalSourceTiles,
    usedTiles: mapping.ordered.length,
    reductionPercent,
    outputTmjPath,
    outputWebpPath,
    outputBytes: atlas.buffer.byteLength,
    sourceArea,
    outputArea,
  };
}
