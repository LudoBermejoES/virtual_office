import type * as Phaser from "phaser";
import { DESK_SIZE_PX, DESK_HALF } from "@virtual-office/shared";
import { THEME } from "./theme.js";

export type DeskRenderState =
  | "idle"
  | "selected"
  | "placing"
  | "invalid"
  | "free"
  | "mine"
  | "occupied"
  | "fixed";

export interface DeskCorners {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function deskCorners(x: number, y: number): DeskCorners {
  return {
    left: x - DESK_HALF,
    top: y - DESK_HALF,
    right: x + DESK_HALF,
    bottom: y + DESK_HALF,
  };
}

const COLORS: Record<DeskRenderState, number> = {
  idle: THEME.free,
  selected: THEME.mine,
  placing: THEME.warning,
  invalid: THEME.danger,
  free: THEME.free,
  mine: THEME.mine,
  occupied: THEME.occupied,
  fixed: THEME.fixed,
};

export function drawDesk(
  scene: Phaser.Scene,
  desk: { x: number; y: number },
  state: DeskRenderState = "idle",
): Phaser.GameObjects.Rectangle {
  const rect = scene.add.rectangle(
    desk.x,
    desk.y,
    DESK_SIZE_PX,
    DESK_SIZE_PX,
    COLORS[state],
    state === "placing" ? 0.5 : 0.8,
  );
  rect.setStrokeStyle(2, 0xffffff, 1);
  return rect;
}
