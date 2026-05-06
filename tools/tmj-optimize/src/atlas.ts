import sharp from "sharp";
import type { GidMapping } from "./mapping.js";
import type { TmjTilesetEmbedded } from "./tmj.js";

export interface AtlasOptions {
  padding?: number;
  lossless?: boolean;
  quality?: number;
}

export interface AtlasResult {
  buffer: Buffer;
  cols: number;
  rows: number;
  width: number;
  height: number;
}

/**
 * Compone el atlas WebP a partir de los buffers de los tilesets fuente y el mapping ordenado.
 * `tilesetBuffers[i]` corresponde al `tilesets[i]` paralelo.
 */
export async function composeAtlas(
  tilesets: TmjTilesetEmbedded[],
  tilesetBuffers: Buffer[],
  mapping: GidMapping,
  tileWidth: number,
  tileHeight: number,
  options: AtlasOptions = {},
): Promise<AtlasResult> {
  const padding = Math.max(0, options.padding ?? 0);
  const lossless = options.lossless ?? true;
  const quality = options.quality ?? 90;

  const N = mapping.ordered.length;
  if (N === 0) {
    throw new Error("no_tiles_to_compose");
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(N)));
  const rows = Math.max(1, Math.ceil(N / cols));
  const width = cols * tileWidth + (cols - 1) * padding;
  const height = rows * tileHeight + (rows - 1) * padding;

  // Recortar cada tile fuente y posicionarlo en el atlas.
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < N; i++) {
    const entry = mapping.ordered[i]!;
    const ts = tilesets[entry.sourceTilesetIndex]!;
    const buf = tilesetBuffers[entry.sourceTilesetIndex]!;
    const srcX = ts.margin + (entry.sourceLocalId % ts.columns) * (ts.tilewidth + ts.spacing);
    const srcY =
      ts.margin + Math.floor(entry.sourceLocalId / ts.columns) * (ts.tileheight + ts.spacing);
    const tile = await sharp(buf)
      .extract({ left: srcX, top: srcY, width: ts.tilewidth, height: ts.tileheight })
      .png()
      .toBuffer();
    const dstX = (i % cols) * (tileWidth + padding);
    const dstY = Math.floor(i / cols) * (tileHeight + padding);
    composites.push({ input: tile, left: dstX, top: dstY });
  }

  const canvas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  let pipeline = canvas.composite(composites);
  pipeline = lossless ? pipeline.webp({ lossless: true }) : pipeline.webp({ quality });
  const buffer = await pipeline.toBuffer();

  return { buffer, cols, rows, width, height };
}
