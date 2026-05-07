/**
 * Re-export del manifest compartido. La fuente única vive en
 * `@virtual-office/shared` para que backend y frontend validen contra el mismo
 * conjunto de ids.
 */
export {
  SPRITE_MANIFEST,
  type SpriteManifest,
  type SpriteManifestEntry,
} from "@virtual-office/shared";
