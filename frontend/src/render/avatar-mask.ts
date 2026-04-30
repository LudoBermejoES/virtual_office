import type * as Phaser from "phaser";
import { colorForUser, getInitials, hslToRgb, rgbToInt } from "./avatar-helpers.js";

export const AVATAR_DIAMETER = 40;
const AVATAR_RADIUS = AVATAR_DIAMETER / 2;

export interface AvatarVisual {
  destroy(): void;
}

/**
 * Renderiza una foto de avatar circular centrada en (x, y).
 * Devuelve un objeto con `destroy()` que elimina la imagen y la máscara.
 */
export function placeAvatar(
  scene: Phaser.Scene,
  textureKey: string,
  x: number,
  y: number,
): AvatarVisual {
  const photo = scene.add.image(x, y, textureKey).setDisplaySize(AVATAR_DIAMETER, AVATAR_DIAMETER);
  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillCircle(x, y, AVATAR_RADIUS);
  photo.setMask(maskShape.createGeometryMask());
  return {
    destroy() {
      photo.destroy();
      maskShape.destroy();
    },
  };
}

/**
 * Dibuja un círculo de color con las iniciales del usuario.
 * Color determinístico por userId.
 */
export function placeFallback(
  scene: Phaser.Scene,
  x: number,
  y: number,
  user: { id: number; name: string },
): AvatarVisual {
  const color = rgbToInt(hslToRgb(colorForUser(user.id)));
  const circle = scene.add.circle(x, y, AVATAR_RADIUS, color, 1);
  circle.setStrokeStyle(2, 0xffffff, 1);
  const text = scene.add
    .text(x, y, getInitials(user.name), {
      fontFamily: '"Press Start 2P"',
      fontSize: "12px",
      color: "#ffffff",
    })
    .setOrigin(0.5);
  return {
    destroy() {
      circle.destroy();
      text.destroy();
    },
  };
}
