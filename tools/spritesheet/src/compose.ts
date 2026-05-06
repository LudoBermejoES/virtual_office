import sharp from "sharp";
import type { Layout } from "./layout.js";

export interface ComposeOptions {
  webp?: boolean;
}

/**
 * Compone el spritesheet apilando cada strip en su fila correspondiente.
 * `stripBuffers[i]` corresponde a `layout.placements[i].strip`.
 */
export async function composeSheet(
  layout: Layout,
  stripBuffers: Buffer[],
  options: ComposeOptions = {},
): Promise<Buffer> {
  if (layout.totalTiles === 0) {
    throw new Error("no_strips_to_compose");
  }

  const composites = layout.placements.map((p, i) => ({
    input: stripBuffers[i]!,
    left: 0,
    top: p.row * layout.tile,
  }));

  const canvas = sharp({
    create: {
      width: layout.outWidth,
      height: layout.outHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
    limitInputPixels: false,
  });

  const pipeline = canvas.composite(composites);
  if (options.webp) {
    return pipeline.webp({ lossless: true }).toBuffer();
  }
  return pipeline.png().toBuffer();
}
