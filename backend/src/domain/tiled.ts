import { z } from "zod";

const FILENAME_REGEX = /^[a-zA-Z0-9_.-]+\.(png|webp)$/;

const TilesetEmbedded = z
  .object({
    firstgid: z.number().int().positive(),
    name: z.string(),
    image: z.string().regex(FILENAME_REGEX),
    imagewidth: z.number().int().positive(),
    imageheight: z.number().int().positive(),
    tilewidth: z.number().int().positive(),
    tileheight: z.number().int().positive(),
  })
  .passthrough()
  .refine((t) => !("source" in t) || t["source"] === undefined, {
    message: "external_tilesets_unsupported",
  });

const TileLayer = z
  .object({
    type: z.literal("tilelayer"),
    name: z.string(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    data: z.union([z.array(z.number()), z.string()]),
    encoding: z.enum(["csv", "base64"]).optional(),
    compression: z.string().optional(),
  })
  .passthrough()
  .refine((l) => !l.compression || l.compression === "", {
    message: "compression_unsupported",
  });

const ObjectLayer = z
  .object({
    type: z.literal("objectgroup"),
    name: z.string(),
    objects: z.array(
      z
        .object({
          id: z.number(),
          name: z.string().default(""),
          x: z.number(),
          y: z.number(),
          width: z.number().default(0),
          height: z.number().default(0),
          point: z.boolean().optional(),
          type: z.string().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const VERSION_REGEX = /^1\.[1-9][0-9]+/;
const MAX_PX = 4096;

export const TiledMapSchema = z
  .object({
    type: z.literal("map"),
    version: z.string(),
    orientation: z.literal("orthogonal", { message: "orientation_unsupported" }),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    tilewidth: z.number().int().min(8).max(64),
    tileheight: z.number().int().min(8).max(64),
    infinite: z.literal(false).optional(),
    tilesets: z.array(TilesetEmbedded).min(1).max(8),
    layers: z.array(z.union([TileLayer, ObjectLayer])).min(1),
  })
  .passthrough()
  .refine((m) => VERSION_REGEX.test(m.version), { message: "tiled_version_unsupported" })
  .refine((m) => m.width * m.tilewidth <= MAX_PX && m.height * m.tileheight <= MAX_PX, {
    message: "map_too_large",
  });

export type TiledMap = z.infer<typeof TiledMapSchema>;

export interface TilesetMatchOk {
  ok: true;
}
export interface TilesetMatchErr {
  ok: false;
  reason: "tileset_mismatch";
  details: string[];
}

export function checkTilesetMatch(
  tmj: { tilesets: { image: string }[] },
  filenames: string[],
): TilesetMatchOk | TilesetMatchErr {
  const expected = new Set(tmj.tilesets.map((t) => t.image));
  const received = new Set(filenames);
  const missing = [...expected].filter((x) => !received.has(x));
  const extra = [...received].filter((x) => !expected.has(x));
  if (missing.length || extra.length) {
    return {
      ok: false,
      reason: "tileset_mismatch",
      details: [...missing.map((m) => `missing: ${m}`), ...extra.map((e) => `extra: ${e}`)],
    };
  }
  return { ok: true };
}

export function parseTiled(
  rawJson: string,
): { ok: true; map: TiledMap } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, reason: "invalid_tmj" };
  }

  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "invalid_tmj" };
  const obj = parsed as Record<string, unknown>;

  if (typeof obj["version"] === "string" && !VERSION_REGEX.test(obj["version"])) {
    return { ok: false, reason: "tiled_version_unsupported" };
  }
  if (typeof obj["orientation"] === "string" && obj["orientation"] !== "orthogonal") {
    return { ok: false, reason: "orientation_unsupported" };
  }

  if (Array.isArray(obj["tilesets"])) {
    for (const t of obj["tilesets"] as Record<string, unknown>[]) {
      if (typeof t["source"] === "string" && t["source"].length > 0) {
        return { ok: false, reason: "external_tilesets_unsupported" };
      }
    }
  }

  if (Array.isArray(obj["layers"])) {
    for (const l of obj["layers"] as Record<string, unknown>[]) {
      if (
        l["type"] === "tilelayer" &&
        typeof l["compression"] === "string" &&
        l["compression"] !== ""
      ) {
        return { ok: false, reason: "compression_unsupported" };
      }
    }
  }

  if (
    typeof obj["width"] === "number" &&
    typeof obj["tilewidth"] === "number" &&
    typeof obj["height"] === "number" &&
    typeof obj["tileheight"] === "number"
  ) {
    if (obj["width"] * obj["tilewidth"] > MAX_PX || obj["height"] * obj["tileheight"] > MAX_PX) {
      return { ok: false, reason: "map_too_large" };
    }
  }

  const result = TiledMapSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "invalid_tmj" };
  }
  return { ok: true, map: result.data };
}
