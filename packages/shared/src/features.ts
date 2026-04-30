export type ZoneKind = "open" | "meeting" | "kitchen" | "phone-booth" | "hall";
export type LabelFont = "display" | "body";
export type LabelSize = 12 | 16 | 24;
export type FeatureKind = "zone" | "room" | "label";

export type RectGeometry = { type: "rect"; x: number; y: number; w: number; h: number };
export type PolygonGeometry = { type: "polygon"; points: { x: number; y: number }[] };
export type Geometry = RectGeometry | PolygonGeometry;
export type PointGeometry = { type: "point"; x: number; y: number };

export interface Zone {
  id?: number;
  name: string;
  kind: ZoneKind;
  geometry: RectGeometry | PolygonGeometry;
}

export interface Room {
  id?: number;
  name: string;
  kind: ZoneKind;
  geometry: RectGeometry | PolygonGeometry;
}

export interface Label {
  id?: number;
  name: string;
  font: LabelFont;
  size: LabelSize;
  geometry: PointGeometry;
}

export interface OfficeFeaturesPayload {
  zones: Zone[];
  rooms: Room[];
  labels: Label[];
}
