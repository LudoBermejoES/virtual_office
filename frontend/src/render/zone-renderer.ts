import type * as Phaser from "phaser";
import type { Zone, Label, ZoneKind, LabelFont } from "@virtual-office/shared";
import { THEME } from "./theme.js";

function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function pointInPolygon(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]!.x,
      yi = pts[i]!.y;
    const xj = pts[j]!.x,
      yj = pts[j]!.y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function findZoneAt(px: number, py: number, zones: Zone[]): Zone | null {
  for (const zone of zones) {
    if (zone.geometry.type === "rect") {
      const { x, y, w, h } = zone.geometry;
      if (pointInRect(px, py, x, y, w, h)) return zone;
    } else {
      if (pointInPolygon(px, py, zone.geometry.points)) return zone;
    }
  }
  return null;
}

export const ZONE_COLORS: Record<ZoneKind, number> = {
  open: THEME.success,
  meeting: THEME.accent,
  kitchen: THEME.warning,
  "phone-booth": THEME.mine,
  hall: THEME.muted,
};

export const zoneAlpha = 0.25;

export function labelFontClass(font: LabelFont): string {
  return `font-${font}`;
}

const ZONE_DEPTH = -10;

export function drawZone(graphics: Phaser.GameObjects.Graphics, zone: Zone): void {
  const color = ZONE_COLORS[zone.kind];
  graphics.setDepth(ZONE_DEPTH);
  graphics.fillStyle(color, zoneAlpha);
  graphics.lineStyle(1, color, 0.6);

  if (zone.geometry.type === "rect") {
    const { x, y, w, h } = zone.geometry;
    graphics.fillRect(x, y, w, h);
    graphics.strokeRect(x, y, w, h);
  } else {
    const pts = zone.geometry.points as never[];
    graphics.fillPoints(pts, true, true);
    graphics.strokePoints(pts, true, true);
  }
}

export function drawLabel(scene: Phaser.Scene, label: Label): Phaser.GameObjects.Text {
  const fontFamily = label.font === "display" ? '"Press Start 2P"' : "VT323";
  const text = scene.add.text(label.geometry.x, label.geometry.y, label.name, {
    fontFamily,
    fontSize: `${label.size}px`,
    color: "#f5f5f5",
    stroke: "#0b0d1a",
    strokeThickness: 2,
  });
  text.setDepth(ZONE_DEPTH + 1);
  return text;
}
