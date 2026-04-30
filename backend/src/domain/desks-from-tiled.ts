export interface ParsedTiledDesk {
  label: string;
  x: number;
  y: number;
  objectId: number;
}

export interface ParseWarning {
  objectId: number;
  reason: "unsupported_object_type";
}

export interface ParseDesksResult {
  desks: ParsedTiledDesk[];
  warnings: ParseWarning[];
}

interface TiledObject {
  id: number;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  polygon?: unknown;
  polyline?: unknown;
  ellipse?: boolean;
}

interface TiledLayerLike {
  type: string;
  name: string;
  objects?: TiledObject[];
}

export function parseDesksFromTiled(tmj: { layers?: TiledLayerLike[] }): ParseDesksResult {
  const layer = tmj.layers?.find((l) => l.type === "objectgroup" && l.name === "desks");
  if (!layer || !layer.objects) return { desks: [], warnings: [] };

  const desks: ParsedTiledDesk[] = [];
  const warnings: ParseWarning[] = [];
  let autoIndex = 1;

  for (const obj of layer.objects) {
    const isPoint = obj.point === true;
    const isRect =
      !isPoint &&
      !obj.ellipse &&
      !obj.polygon &&
      !obj.polyline &&
      typeof obj.width === "number" &&
      typeof obj.height === "number" &&
      obj.width > 0 &&
      obj.height > 0;

    if (!isPoint && !isRect) {
      warnings.push({ objectId: obj.id, reason: "unsupported_object_type" });
      continue;
    }

    const x = isPoint ? obj.x : obj.x + (obj.width ?? 0) / 2;
    const y = isPoint ? obj.y : obj.y + (obj.height ?? 0) / 2;
    const label = obj.name && obj.name.trim().length > 0 ? obj.name : `T${autoIndex++}`;

    desks.push({ label, x: Math.round(x), y: Math.round(y), objectId: obj.id });
  }

  return { desks, warnings };
}
