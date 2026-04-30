import type * as Phaser from "phaser";
import { colorForUser, hslToRgb, rgbToInt } from "./avatar-helpers.js";

export const SEAT_SPRITE_KEY = "desk-sit";
export const SEAT_ANIM_KEY = "desk-sit-idle";

export function seatTint(userId: number): number {
  return rgbToInt(hslToRgb(colorForUser(userId)));
}

export function placeSeatSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  userId: number,
): Phaser.GameObjects.Sprite | null {
  if (!userId) return null;
  if (!scene.textures.exists(SEAT_SPRITE_KEY)) return null;

  const sprite = scene.add.sprite(x, y, SEAT_SPRITE_KEY, 0);
  sprite.setTint(seatTint(userId));
  sprite.setDepth(-5);

  if (scene.anims.exists(SEAT_ANIM_KEY)) {
    sprite.play(SEAT_ANIM_KEY);
  }

  return sprite;
}
