import { basename } from "node:path";
import type { FrameSizesManifest } from "./frame-sizes.js";

export type Mode = "atlas" | "collection";

export interface PngInfo {
  filename: string; // basename con extensión
  width: number;
  height: number;
}

export interface EffectiveSize {
  png: PngInfo;
  frame_width: number;
  frame_height: number;
  frame_count: number;
  row_count: number;
}

/**
 * Calcula el tamaño efectivo de frame para un PNG.
 * 1. Si el manifest declara dimensiones para este filename → úsalas y valida.
 * 2. Si no, asume cuadrado: frame_width = frame_height = png.height.
 *    Requiere width % height === 0.
 */
export function effectiveFrameSize(png: PngInfo, manifest: FrameSizesManifest): EffectiveSize {
  const declared = manifest[png.filename];
  if (declared) {
    const { frame_width, frame_height } = declared;
    if (png.width % frame_width !== 0) {
      throw new Error(
        `frame_size_mismatch: ${png.filename} ancho ${png.width} no es múltiplo de frame_width ${frame_width}`,
      );
    }
    if (png.height % frame_height !== 0) {
      throw new Error(
        `frame_size_mismatch: ${png.filename} alto ${png.height} no es múltiplo de frame_height ${frame_height}`,
      );
    }
    return {
      png,
      frame_width,
      frame_height,
      frame_count: png.width / frame_width,
      row_count: png.height / frame_height,
    };
  }
  // Sin manifest: asume cuadrado. Aceptamos:
  // - Strip horizontal: width % height === 0 → frame_size = height
  // - Grid 2D donde height divide width: width % height === 0 con N filas
  //   → asumimos frame_size = height y row_count = 1, MULTI-ROW REQUIERE MANIFEST.
  //
  // Para evitar deducciones absurdas (ej. 100×48 → frames de 4×4), solo aceptamos
  // si height divide a width y producen frames de tamaño "razonable" (height === el
  // tamaño efectivo). Si height > width o no divide, error pidiendo manifest.
  if (png.width === 0 || png.height === 0) {
    throw new Error(`invalid_png: ${png.filename} dimensiones inválidas`);
  }
  if (png.height <= png.width && png.width % png.height === 0) {
    const size = png.height;
    return {
      png,
      frame_width: size,
      frame_height: size,
      frame_count: png.width / size,
      row_count: 1,
    };
  }
  // Multi-row sin manifest: aceptamos solo si el "pequeño lado" divide al "grande"
  // y el resultado encaja. Caso típico: 144×96 = 3 cols × 2 rows con frames 48×48.
  const candidate = Math.min(png.width, png.height);
  // Probamos divisores comunes razonables: 48, 32, 16 (típicos de pixel-art).
  for (const d of [48, 32, 16, 64, 24]) {
    if (d > candidate) continue;
    if (png.width % d === 0 && png.height % d === 0) {
      return {
        png,
        frame_width: d,
        frame_height: d,
        frame_count: png.width / d,
        row_count: png.height / d,
      };
    }
  }
  throw new Error(
    `frame_size_undeducible: ${png.filename} (${png.width}x${png.height}) — añade entrada en frame_sizes.json`,
  );
}

/**
 * Decide modo atlas (todos los frames del mismo tamaño cuadrado) o collection.
 */
export function detectMode(sizes: EffectiveSize[]): Mode {
  if (sizes.length === 0) return "atlas";
  const first = sizes[0]!;
  const allSquare = sizes.every((s) => s.frame_width === s.frame_height);
  const allSame = sizes.every(
    (s) => s.frame_width === first.frame_width && s.frame_height === first.frame_height,
  );
  return allSquare && allSame ? "atlas" : "collection";
}

/** Util para tests: construir PngInfo a partir de un path. */
export function pngInfoFromPath(path: string, width: number, height: number): PngInfo {
  return { filename: basename(path), width, height };
}
