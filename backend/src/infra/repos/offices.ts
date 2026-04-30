import type { DatabaseSync } from "node:sqlite";

export interface OfficeRow {
  id: number;
  name: string;
  tmj_filename: string;
  tile_width: number;
  tile_height: number;
  cells_x: number;
  cells_y: number;
  map_width: number;
  map_height: number;
  created_at: string;
}

export interface OfficeTilesetRow {
  id: number;
  office_id: number;
  ordinal: number;
  image_name: string;
  filename: string;
  mime_type: "image/png" | "image/webp";
  animations_json: string;
}

export function createOffice(
  db: DatabaseSync,
  data: Omit<OfficeRow, "id" | "created_at">,
): OfficeRow {
  const result = db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.name,
      data.tmj_filename,
      data.tile_width,
      data.tile_height,
      data.cells_x,
      data.cells_y,
      data.map_width,
      data.map_height,
    );
  const id = Number(result.lastInsertRowid);
  return findOfficeById(db, id)!;
}

export function updateOfficeBundle(
  db: DatabaseSync,
  id: number,
  data: {
    tmj_filename: string;
    tile_width: number;
    tile_height: number;
    cells_x: number;
    cells_y: number;
    map_width: number;
    map_height: number;
  },
): OfficeRow {
  db.prepare(
    `UPDATE offices SET tmj_filename=?, tile_width=?, tile_height=?, cells_x=?, cells_y=?, map_width=?, map_height=? WHERE id=?`,
  ).run(
    data.tmj_filename,
    data.tile_width,
    data.tile_height,
    data.cells_x,
    data.cells_y,
    data.map_width,
    data.map_height,
    id,
  );
  return findOfficeById(db, id)!;
}

export function updateOfficeName(db: DatabaseSync, id: number, name: string): OfficeRow {
  db.prepare("UPDATE offices SET name=? WHERE id=?").run(name, id);
  return findOfficeById(db, id)!;
}

export function findOfficeById(db: DatabaseSync, id: number): OfficeRow | null {
  return (
    (db.prepare("SELECT * FROM offices WHERE id = ?").get(id) as unknown as
      | OfficeRow
      | undefined) ?? null
  );
}

export function listOffices(db: DatabaseSync): OfficeRow[] {
  return db.prepare("SELECT * FROM offices ORDER BY id DESC").all() as unknown as OfficeRow[];
}

export function deleteOffice(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM offices WHERE id = ?").run(id);
}

export function replaceTilesets(
  db: DatabaseSync,
  officeId: number,
  tilesets: Array<Omit<OfficeTilesetRow, "id" | "office_id">>,
): OfficeTilesetRow[] {
  db.prepare("DELETE FROM office_tilesets WHERE office_id = ?").run(officeId);
  const insert = db.prepare(
    `INSERT INTO office_tilesets (office_id, ordinal, image_name, filename, mime_type, animations_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const t of tilesets) {
    insert.run(
      officeId,
      t.ordinal,
      t.image_name,
      t.filename,
      t.mime_type,
      t.animations_json ?? "[]",
    );
  }
  return listTilesets(db, officeId);
}

export function listTilesets(db: DatabaseSync, officeId: number): OfficeTilesetRow[] {
  return db
    .prepare("SELECT * FROM office_tilesets WHERE office_id = ? ORDER BY ordinal")
    .all(officeId) as unknown as OfficeTilesetRow[];
}
