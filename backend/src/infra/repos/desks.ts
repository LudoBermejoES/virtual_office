import type { DatabaseSync } from "node:sqlite";

export type DeskSource = "manual" | "tiled";

export interface DeskRow {
  id: number;
  office_id: number;
  label: string;
  x: number;
  y: number;
  source: DeskSource;
  created_at: string;
}

export function createDesk(
  db: DatabaseSync,
  data: { office_id: number; label: string; x: number; y: number; source?: DeskSource },
): DeskRow {
  const result = db
    .prepare(`INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)`)
    .run(data.office_id, data.label, data.x, data.y, data.source ?? "manual");
  return findDeskById(db, Number(result.lastInsertRowid))!;
}

export function updateDesk(
  db: DatabaseSync,
  id: number,
  data: Partial<Pick<DeskRow, "label" | "x" | "y">>,
): DeskRow | null {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.label !== undefined) {
    fields.push("label = ?");
    values.push(data.label);
  }
  if (data.x !== undefined) {
    fields.push("x = ?");
    values.push(data.x);
  }
  if (data.y !== undefined) {
    fields.push("y = ?");
    values.push(data.y);
  }
  if (fields.length === 0) return findDeskById(db, id);
  values.push(id);
  db.prepare(`UPDATE desks SET ${fields.join(", ")} WHERE id = ?`).run(
    ...(values as (string | number)[]),
  );
  return findDeskById(db, id);
}

export function deleteDesk(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM desks WHERE id = ?").run(id);
}

export function findDeskById(db: DatabaseSync, id: number): DeskRow | null {
  return (
    (db.prepare("SELECT * FROM desks WHERE id = ?").get(id) as unknown as DeskRow | undefined) ??
    null
  );
}

export function listByOffice(db: DatabaseSync, officeId: number): DeskRow[] {
  return db
    .prepare("SELECT * FROM desks WHERE office_id = ? ORDER BY id")
    .all(officeId) as unknown as DeskRow[];
}

export function findByLabel(db: DatabaseSync, officeId: number, label: string): DeskRow | null {
  return (
    (db
      .prepare("SELECT * FROM desks WHERE office_id = ? AND label = ?")
      .get(officeId, label) as unknown as DeskRow | undefined) ?? null
  );
}

export function countByOffice(db: DatabaseSync, officeId: number): number {
  return (
    db.prepare("SELECT COUNT(*) as c FROM desks WHERE office_id = ?").get(officeId) as {
      c: number;
    }
  ).c;
}
