/**
 * Manifest de sprites Aseprite disponibles para anclar a object layers
 * `sprites_*` del TMJ. Compartido entre frontend (carga + render Phaser) y
 * backend (validación de ids al guardar capas `sprites_*`).
 *
 * Los assets se sirven estáticamente desde `frontend/public/sprites/<id>/`.
 */

export interface SpriteManifestEntry {
  png: string;
  json: string;
  defaultTag?: string;
}

export type SpriteManifest = Record<string, SpriteManifestEntry>;

export const SPRITE_MANIFEST: SpriteManifest = {
  cat: {
    png: "/sprites/cat/animated_cat_48x48.png",
    json: "/sprites/cat/animated_cat_48x48.json",
    defaultTag: "walk",
  },
  candle: {
    png: "/sprites/candle/animated_wall_candle_48x48.png",
    json: "/sprites/candle/animated_wall_candle_48x48.json",
    defaultTag: "idle",
  },
  butterfly_6: {
    png: "/sprites/butterfly_6/animated_butterfly_6_idle_48x48.png",
    json: "/sprites/butterfly_6/animated_butterfly_6_idle_48x48.json",
    defaultTag: "idle",
  },
  security_camera_1: {
    png: "/sprites/security_camera_1/animated_security_camera_left_48x48.png",
    json: "/sprites/security_camera_1/animated_security_camera_left_48x48.json",
    defaultTag: "left",
  },
};
