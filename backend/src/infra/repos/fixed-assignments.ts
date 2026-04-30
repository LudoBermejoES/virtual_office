import type { DatabaseSync } from "node:sqlite";

export interface FixedAssignmentRow {
  id: number;
  desk_id: number;
  user_id: number;
  assigned_by_user_id: number;
  created_at: string;
}

export class FixedAssignmentConflict extends Error {
  constructor(public readonly column: "desk_id" | "user_id") {
    super(`unique violation: ${column}`);
  }
}

export function createFixedAssignment(
  db: DatabaseSync,
  data: { desk_id: number; user_id: number; assigned_by_user_id: number },
): FixedAssignmentRow {
  try {
    const result = db
      .prepare(
        `INSERT INTO fixed_assignments (desk_id, user_id, assigned_by_user_id) VALUES (?, ?, ?)`,
      )
      .run(data.desk_id, data.user_id, data.assigned_by_user_id);
    return findFixedAssignmentById(db, Number(result.lastInsertRowid))!;
  } catch (e) {
    const message = (e as Error).message ?? "";
    if (/UNIQUE.*fixed_assignments\.desk_id/.test(message)) {
      throw new FixedAssignmentConflict("desk_id");
    }
    if (/UNIQUE.*fixed_assignments\.user_id/.test(message)) {
      throw new FixedAssignmentConflict("user_id");
    }
    throw e;
  }
}

export function deleteFixedAssignmentByDesk(db: DatabaseSync, deskId: number): boolean {
  const r = db.prepare("DELETE FROM fixed_assignments WHERE desk_id = ?").run(deskId);
  return r.changes > 0;
}

export function findFixedAssignmentById(db: DatabaseSync, id: number): FixedAssignmentRow | null {
  return (
    (db.prepare("SELECT * FROM fixed_assignments WHERE id = ?").get(id) as unknown as
      | FixedAssignmentRow
      | undefined) ?? null
  );
}

export function findByDeskId(db: DatabaseSync, deskId: number): FixedAssignmentRow | null {
  return (
    (db.prepare("SELECT * FROM fixed_assignments WHERE desk_id = ?").get(deskId) as unknown as
      | FixedAssignmentRow
      | undefined) ?? null
  );
}

export function findByUserId(db: DatabaseSync, userId: number): FixedAssignmentRow | null {
  return (
    (db.prepare("SELECT * FROM fixed_assignments WHERE user_id = ?").get(userId) as unknown as
      | FixedAssignmentRow
      | undefined) ?? null
  );
}

export interface FixedAssignmentWithUser extends FixedAssignmentRow {
  userName: string;
  userAvatarUrl: string | null;
}

export function listByOffice(db: DatabaseSync, officeId: number): FixedAssignmentWithUser[] {
  return db
    .prepare(
      `SELECT f.*, u.name AS userName, u.avatar_url AS userAvatarUrl
         FROM fixed_assignments f
         JOIN desks d ON d.id = f.desk_id
         JOIN users u ON u.id = f.user_id
         WHERE d.office_id = ?`,
    )
    .all(officeId) as unknown as FixedAssignmentWithUser[];
}
