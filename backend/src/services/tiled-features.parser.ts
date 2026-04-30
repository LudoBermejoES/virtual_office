import { z } from "zod";
import type { Zone, Room, Label, OfficeFeaturesPayload } from "@virtual-office/shared";

const MAX_FEATURES = 200;
const MAX_POLYGON_POINTS = 64;
const MIN_POLYGON_POINTS = 3;

const NAME_REGEX = /^[^\x00-\x1f\x7f]{1,80}$/;

const KindSchema = z.enum(["open", "meeting", "kitchen", "phone-booth", "hall"]);
const FontSchema = z.enum(["display", "body"]);
const SizeSchema = z.union([z.literal(12), z.literal(16), z.literal(24)]);

type TiledProperty = { name: string; type: string; value: unknown };

function getProp<T>(props: TiledProperty[], name: string): T | undefined {
  return props.find((p) => p.name === name)?.value as T | undefined;
}

function validateName(name: string, context: string): void {
  if (!NAME_REGEX.test(name)) {
    throw new Error(`invalid_feature_name: "${name}" en ${context}`);
  }
}

function checkBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  mapW: number,
  mapH: number,
  name: string,
): void {
  if (x < 0 || y < 0 || x + w > mapW || y + h > mapH) {
    throw new Error(
      `feature_out_of_bounds: "${name}" en (${x},${y}) size ${w}x${h} mapa ${mapW}x${mapH}`,
    );
  }
}

function checkPointBounds(px: number, py: number, mapW: number, mapH: number, name: string): void {
  if (px < 0 || py < 0 || px > mapW || py > mapH) {
    throw new Error(
      `feature_out_of_bounds: "${name}" punto (${px},${py}) fuera del mapa ${mapW}x${mapH}`,
    );
  }
}

export function parseTiledFeatures(tmj: Record<string, unknown>): OfficeFeaturesPayload {
  const mapW = (tmj["width"] as number) * (tmj["tilewidth"] as number);
  const mapH = (tmj["height"] as number) * (tmj["tileheight"] as number);
  const layers = (tmj["layers"] as unknown[]) ?? [];

  const zones: Zone[] = [];
  const rooms: Room[] = [];
  const labels: Label[] = [];

  for (const layer of layers) {
    const l = layer as Record<string, unknown>;
    if (l["type"] !== "objectgroup") continue;
    const layerName = (l["name"] as string) ?? "";
    const objects = (l["objects"] as unknown[]) ?? [];

    if (layerName === "zones" || layerName === "rooms") {
      for (const obj of objects) {
        const o = obj as Record<string, unknown>;
        const name = (o["name"] as string) ?? "";
        validateName(name, layerName);

        const props = (o["properties"] as TiledProperty[]) ?? [];
        const kindRaw = getProp<string>(props, "kind");
        const kindResult = KindSchema.safeParse(kindRaw);
        if (!kindResult.success) {
          throw new Error(`invalid_feature_kind: kind="${kindRaw}" no válido para "${name}"`);
        }
        const kind = kindResult.data;

        const ox = (o["x"] as number) ?? 0;
        const oy = (o["y"] as number) ?? 0;

        if (o["polygon"]) {
          const rawPts = o["polygon"] as { x: number; y: number }[];
          if (rawPts.length < MIN_POLYGON_POINTS) {
            throw new Error(
              `invalid_polygon: "${name}" tiene ${rawPts.length} puntos (mín ${MIN_POLYGON_POINTS})`,
            );
          }
          if (rawPts.length > MAX_POLYGON_POINTS) {
            throw new Error(
              `invalid_polygon: "${name}" tiene ${rawPts.length} puntos (máx ${MAX_POLYGON_POINTS})`,
            );
          }
          const points = rawPts.map((p) => ({ x: ox + p.x, y: oy + p.y }));
          for (const pt of points) {
            checkPointBounds(pt.x, pt.y, mapW, mapH, name);
          }
          const feature = { name, kind, geometry: { type: "polygon" as const, points } };
          if (layerName === "zones") zones.push(feature);
          else rooms.push(feature);
        } else {
          const w = (o["width"] as number) ?? 0;
          const h = (o["height"] as number) ?? 0;
          checkBounds(ox, oy, w, h, mapW, mapH, name);
          const feature = { name, kind, geometry: { type: "rect" as const, x: ox, y: oy, w, h } };
          if (layerName === "zones") zones.push(feature);
          else rooms.push(feature);
        }
      }
    }

    if (layerName === "labels") {
      for (const obj of objects) {
        const o = obj as Record<string, unknown>;
        const name = (o["name"] as string) ?? "";
        validateName(name, "labels");

        const props = (o["properties"] as TiledProperty[]) ?? [];
        const font = FontSchema.parse(getProp<string>(props, "font") ?? "body");
        const size = SizeSchema.parse(getProp<number>(props, "size") ?? 16);
        const x = (o["x"] as number) ?? 0;
        const y = (o["y"] as number) ?? 0;
        checkPointBounds(x, y, mapW, mapH, name);

        labels.push({ name, font, size, geometry: { type: "point", x, y } });
      }
    }
  }

  const total = zones.length + rooms.length + labels.length;
  if (total > MAX_FEATURES) {
    throw new Error(`too_many_features: ${total} features (máx ${MAX_FEATURES})`);
  }

  return { zones, rooms, labels };
}
