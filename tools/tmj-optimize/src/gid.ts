import type { TmjTilesetEmbedded } from "./tmj.js";

/** Bits 30..32 codifican flips horizontales/verticales/diagonales. */
export const FLIP_BITS = 0xe0000000 >>> 0;
export const FLIP_MASK = 0x1fffffff;

export function maskGid(gid: number): number {
  return (gid & FLIP_MASK) >>> 0;
}

export function flipBitsOf(gid: number): number {
  return (gid & FLIP_BITS) >>> 0;
}

export function combine(localGid: number, flipBits: number): number {
  return ((localGid & FLIP_MASK) | (flipBits & FLIP_BITS)) >>> 0;
}

export interface ResolvedGid {
  tilesetIndex: number;
  localId: number;
}

/**
 * Localiza un GID dentro de la lista de tilesets ordenada por firstgid ASC.
 * El gid debe estar ya enmascarado (sin bits de flip).
 */
export function resolveGid(cleanGid: number, tilesets: TmjTilesetEmbedded[]): ResolvedGid {
  if (cleanGid === 0) {
    throw new Error("cannot_resolve_gid_zero");
  }
  // tilesets ordenados por firstgid ASC
  let chosen = -1;
  for (let i = 0; i < tilesets.length; i++) {
    if (tilesets[i]!.firstgid <= cleanGid) chosen = i;
    else break;
  }
  if (chosen < 0) {
    throw new Error(`corrupt_gid: ${cleanGid} sin tileset`);
  }
  const ts = tilesets[chosen]!;
  const localId = cleanGid - ts.firstgid;
  if (localId < 0 || localId >= ts.tilecount) {
    throw new Error(`corrupt_gid: ${cleanGid} fuera de rango del tileset ${ts.name}`);
  }
  return { tilesetIndex: chosen, localId };
}
