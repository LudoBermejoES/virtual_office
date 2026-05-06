import type { Strip } from "./strips.js";

export interface Placement {
  strip: Strip;
  row: number;
  firstLocalId: number;
}

export interface Layout {
  tile: number;
  cols: number;
  rows: number;
  outWidth: number;
  outHeight: number;
  placements: Placement[];
  totalTiles: number;
}

export function computeLayout(strips: Strip[], tile: number): Layout {
  if (strips.length === 0) {
    return {
      tile,
      cols: 0,
      rows: 0,
      outWidth: 0,
      outHeight: 0,
      placements: [],
      totalTiles: 0,
    };
  }
  const cols = Math.max(...strips.map((s) => s.frameCount));
  const rows = strips.length;
  const placements: Placement[] = strips.map((strip, i) => ({
    strip,
    row: i,
    firstLocalId: i * cols,
  }));
  return {
    tile,
    cols,
    rows,
    outWidth: cols * tile,
    outHeight: rows * tile,
    placements,
    totalTiles: cols * rows,
  };
}
