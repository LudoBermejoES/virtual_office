/**
 * Manifest de sprites Aseprite disponibles para anclar a object layers
 * `sprites_*` del TMJ. Ver `tiled-sprites.ts` para el flujo de carga y render.
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
};
