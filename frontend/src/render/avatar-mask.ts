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
  const circularKey = `${textureKey}:circle`;

  if (!scene.textures.exists(circularKey)) {
    const src = scene.textures.get(textureKey).getSourceImage() as HTMLImageElement;
    const d = AVATAR_DIAMETER;
    const canvas = document.createElement("canvas");
    canvas.width = d;
    canvas.height = d;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(src, 0, 0, d, d);
    scene.textures.addCanvas(circularKey, canvas);
  }

  const photo = scene.add.image(x, y, circularKey);
  return {
    destroy() {
      photo.destroy();
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
