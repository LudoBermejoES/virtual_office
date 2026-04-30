import { DESK_MIN_SEPARATION, DESK_HALF } from "./desk.js";

export interface Point {
  x: number;
  y: number;
}

export interface MapBounds {
  width: number;
  height: number;
}

export type DeskValidationError =
  | "out_of_bounds"
  | "too_close_to_existing"
  | "label_taken"
  | "office_full";

export function chebyshevDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function validateDeskPlacement(
  x: number,
  y: number,
  bounds: MapBounds,
  others: ReadonlyArray<Point>,
): { ok: true } | { ok: false; reason: DeskValidationError } {
  if (
    x < DESK_HALF ||
    y < DESK_HALF ||
    x > bounds.width - DESK_HALF ||
    y > bounds.height - DESK_HALF
  ) {
    return { ok: false, reason: "out_of_bounds" };
  }
  for (const p of others) {
    if (chebyshevDistance({ x, y }, p) < DESK_MIN_SEPARATION) {
      return { ok: false, reason: "too_close_to_existing" };
    }
  }
  return { ok: true };
}
