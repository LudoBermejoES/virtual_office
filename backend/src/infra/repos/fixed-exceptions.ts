import type { DatabaseSync } from "node:sqlite";

export interface FixedExceptionRow {
  id: number;
  fixed_assignment_id: number;
  date: string;
  created_by_user_id: number;
  created_at: string;
}

export function createException(
  db: DatabaseSync,
  fixedAssignmentId: number,
  date: string,
  createdByUserId: number,
): FixedExceptionRow {
  const existing = findException(db, fixedAssignmentId, date);
  if (existing) return existing;

  const result = db
    .prepare(
      `INSERT INTO fixed_assignment_exceptions (fixed_assignment_id, date, created_by_user_id)
       VALUES (?, ?, ?)`,
    )
    .run(fixedAssignmentId, date, createdByUserId);
  return findExceptionById(db, Number(result.lastInsertRowid))!;
}

export function deleteException(
  db: DatabaseSync,
  fixedAssignmentId: number,
  date: string,
): boolean {
  const r = db
    .prepare("DELETE FROM fixed_assignment_exceptions WHERE fixed_assignment_id = ? AND date = ?")
    .run(fixedAssignmentId, date);
  return r.changes > 0;
}

export function findException(
  db: DatabaseSync,
  fixedAssignmentId: number,
  date: string,
): FixedExceptionRow | null {
  return (
    (db
      .prepare(
        "SELECT * FROM fixed_assignment_exceptions WHERE fixed_assignment_id = ? AND date = ?",
      )
      .get(fixedAssignmentId, date) as unknown as FixedExceptionRow | undefined) ?? null
  );
}

export function findExceptionById(db: DatabaseSync, id: number): FixedExceptionRow | null {
  return (
    (db.prepare("SELECT * FROM fixed_assignment_exceptions WHERE id = ?").get(id) as unknown as
      | FixedExceptionRow
      | undefined) ?? null
  );
}

export function listExceptionsByOfficeAndDate(
  db: DatabaseSync,
  officeId: number,
  date: string,
): FixedExceptionRow[] {
  return db
    .prepare(
      `SELECT e.* FROM fixed_assignment_exceptions e
       JOIN fixed_assignments f ON f.id = e.fixed_assignment_id
       JOIN desks d ON d.id = f.desk_id
       WHERE d.office_id = ? AND e.date = ?`,
    )
    .all(officeId, date) as unknown as FixedExceptionRow[];
}

/**
 * Devuelve la fila de excepción + fixed_assignment_id si el usuario tiene un fijo
 * en esa oficina y existe una excepción para esa fecha.
 */
export function findUserExceptionForDate(
  db: DatabaseSync,
  userId: number,
  officeId: number,
  date: string,
): { fixed_assignment_id: number; desk_id: number; date: string } | null {
  const row = db
    .prepare(
      `SELECT e.fixed_assignment_id, f.desk_id, e.date
       FROM fixed_assignment_exceptions e
       JOIN fixed_assignments f ON f.id = e.fixed_assignment_id
       JOIN desks d ON d.id = f.desk_id
       WHERE f.user_id = ? AND d.office_id = ? AND e.date = ?`,
    )
    .get(userId, officeId, date) as
    | { fixed_assignment_id: number; desk_id: number; date: string }
    | undefined;
  return row ?? null;
}
