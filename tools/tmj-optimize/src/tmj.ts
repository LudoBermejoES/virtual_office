import { z } from "zod";

const TileAnimationFrame = z.object({
  duration: z.number().int().nonnegative(),
  tileid: z.number().int().nonnegative(),
});

const TilesetTile = z.object({
  id: z.number().int().nonnegative(),
  animation: z.array(TileAnimationFrame).optional(),
  properties: z.array(z.unknown()).optional(),
  type: z.string().optional(),
});

const TilesetEmbedded = z
  .object({
    firstgid: z.number().int().positive(),
    name: z.string(),
    image: z.string(),
    imagewidth: z.number().int().positive(),
    imageheight: z.number().int().positive(),
    tilewidth: z.number().int().positive(),
    tileheight: z.number().int().positive(),
    tilecount: z.number().int().positive(),
    columns: z.number().int().positive(),
    margin: z.number().int().nonnegative().optional().default(0),
    spacing: z.number().int().nonnegative().optional().default(0),
    tiles: z.array(TilesetTile).optional(),
  })
  .passthrough();

const TilesetExternal = z.object({
  firstgid: z.number().int().positive(),
  source: z.string(),
});

const TileLayer = z
  .object({
    type: z.literal("tilelayer"),
    name: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    data: z.array(z.number().int().nonnegative()),
  })
  .passthrough();

const TiledObject = z
  .object({
    id: z.number().int().nonnegative(),
    x: z.number(),
    y: z.number(),
    gid: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const ObjectGroup = z
  .object({
    type: z.literal("objectgroup"),
    name: z.string(),
    objects: z.array(TiledObject),
  })
  .passthrough();

const Layer = z.union([TileLayer, ObjectGroup, z.object({ type: z.string() }).passthrough()]);

const TmjSchema = z
  .object({
    type: z.literal("map"),
    version: z.union([z.string(), z.number()]).optional(),
    orientation: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    tilewidth: z.number().int().positive(),
    tileheight: z.number().int().positive(),
    infinite: z.boolean().optional().default(false),
    tilesets: z.array(z.union([TilesetEmbedded, TilesetExternal])),
    layers: z.array(Layer),
  })
  .passthrough();

export type Tmj = z.infer<typeof TmjSchema>;
export type TmjTilesetEmbedded = z.infer<typeof TilesetEmbedded>;
export type TmjTileLayer = z.infer<typeof TileLayer>;
export type TmjObjectGroup = z.infer<typeof ObjectGroup>;
export type TmjTilesetTile = z.infer<typeof TilesetTile>;

export function parseTmj(json: unknown): Tmj {
  const parsed = TmjSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `invalid_tmj: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
    );
  }
  const tmj = parsed.data;

  if (tmj.orientation !== "orthogonal") {
    throw new Error(`only_orthogonal_supported: got ${tmj.orientation}`);
  }
  if (tmj.infinite) {
    throw new Error("infinite_not_supported");
  }
  for (const ts of tmj.tilesets) {
    if ("source" in ts) {
      throw new Error(
        `external_tileset_not_supported: ${ts.source} (embeber con Tiled antes de optimizar)`,
      );
    }
  }

  return tmj;
}

export function isTileLayer(layer: { type: string }): layer is TmjTileLayer {
  return layer.type === "tilelayer";
}

export function isObjectGroup(layer: { type: string }): layer is TmjObjectGroup {
  return layer.type === "objectgroup";
}

export function isEmbeddedTileset(
  ts: { firstgid: number } | { firstgid: number; source: string },
): ts is TmjTilesetEmbedded {
  return !("source" in ts);
}
