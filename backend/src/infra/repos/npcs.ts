import type { DatabaseSync } from "node:sqlite";
import type { NpcEntry } from "../../services/tiled-animations.parser.js";

export interface NpcRow {
  id: number;
  office_id: number;
  name: string;
  x: number;
  y: number;
  sprite: string;
  ordinal: number;
}

export function deleteNpcs(db: DatabaseSync, officeId: number): void {
  db.prepare("DELETE FROM office_npcs WHERE office_id = ?").run(officeId);
}

export function insertNpcs(db: DatabaseSync, officeId: number, npcs: NpcEntry[]): void {
  const stmt = db.prepare(
    "INSERT INTO office_npcs (office_id, name, x, y, sprite, ordinal) VALUES (?, ?, ?, ?, ?, ?)",
  );
  npcs.forEach((npc, i) => {
    stmt.run(officeId, npc.name, npc.x, npc.y, npc.sprite, i);
  });
}

export function listNpcs(db: DatabaseSync, officeId: number): NpcRow[] {
  return db
    .prepare("SELECT * FROM office_npcs WHERE office_id = ? ORDER BY ordinal")
    .all(officeId) as unknown as NpcRow[];
}
