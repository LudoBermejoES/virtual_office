import type { DatabaseSync } from "node:sqlite";
import type { OfficeFeaturesPayload, Zone, Room, Label } from "@virtual-office/shared";

export function deleteFeatures(db: DatabaseSync, officeId: number): void {
  db.prepare("DELETE FROM office_features WHERE office_id = ?").run(officeId);
}

export function insertFeatures(
  db: DatabaseSync,
  officeId: number,
  payload: OfficeFeaturesPayload,
): void {
  const stmt = db.prepare(
    `INSERT INTO office_features (office_id, kind, name, geometry_json, properties_json, ordinal)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  let ordinal = 0;
  for (const z of payload.zones) {
    stmt.run(
      officeId,
      "zone",
      z.name,
      JSON.stringify(z.geometry),
      JSON.stringify({ kind: z.kind }),
      ordinal++,
    );
  }
  for (const r of payload.rooms) {
    stmt.run(
      officeId,
      "room",
      r.name,
      JSON.stringify(r.geometry),
      JSON.stringify({ kind: r.kind }),
      ordinal++,
    );
  }
  for (const l of payload.labels) {
    stmt.run(
      officeId,
      "label",
      l.name,
      JSON.stringify(l.geometry),
      JSON.stringify({ font: l.font, size: l.size }),
      ordinal++,
    );
  }
}

interface FeatureRow {
  id: number;
  office_id: number;
  kind: string;
  name: string;
  geometry_json: string;
  properties_json: string;
  ordinal: number;
}

export function listFeatures(db: DatabaseSync, officeId: number): OfficeFeaturesPayload {
  const rows = db
    .prepare("SELECT * FROM office_features WHERE office_id = ? ORDER BY ordinal")
    .all(officeId) as unknown as FeatureRow[];

  const zones: Zone[] = [];
  const rooms: Room[] = [];
  const labels: Label[] = [];

  for (const row of rows) {
    const geometry = JSON.parse(row.geometry_json);
    const props = JSON.parse(row.properties_json);

    if (row.kind === "zone") {
      zones.push({ id: row.id, name: row.name, kind: props.kind, geometry });
    } else if (row.kind === "room") {
      rooms.push({ id: row.id, name: row.name, kind: props.kind, geometry });
    } else if (row.kind === "label") {
      labels.push({ id: row.id, name: row.name, font: props.font, size: props.size, geometry });
    }
  }

  return { zones, rooms, labels };
}
