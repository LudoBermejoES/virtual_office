/**
 * Repo de `weekly_assignments` y sus excepciones (change 027).
 *
 * Ver `openspec/changes/archive/2026-05-08-027-weekly-recurring-assignments/`
 * (cuando esté archivado) para el modelo.
 *
 * Convenciones:
 *  - `dow` 0..6 con ISO 8601 (0=lunes ... 6=domingo). Ver `dowOfDate` en
 *    `@virtual-office/shared`.
 *  - `findActiveForDeskDate` y `findActiveForUserDate` aplican `weekly_exceptions`
 *    y devuelven null si la fecha está exceptuada.
 */
import type { DatabaseSync } from "node:sqlite";

export interface WeeklyAssignmentRow {
  id: number;
  desk_id: number;
  user_id: number;
  dow: number;
  created_by_user_id: number;
  created_at: string;
}

export class WeeklyAssignmentConflict extends Error {
  constructor(public readonly column: "desk_dow" | "user_dow") {
    super(`unique violation: ${column}`);
  }
}

export function createWeekly(
  db: DatabaseSync,
  data: { desk_id: number; user_id: number; dow: number; created_by_user_id: number },
): WeeklyAssignmentRow {
  try {
    const result = db
      .prepare(
        `INSERT INTO weekly_assignments (desk_id, user_id, dow, created_by_user_id) VALUES (?, ?, ?, ?)`,
      )
      .run(data.desk_id, data.user_id, data.dow, data.created_by_user_id);
    return findWeeklyById(db, Number(result.lastInsertRowid))!;
  } catch (e) {
    const message = (e as Error).message ?? "";
    if (/UNIQUE.*weekly_assignments\.desk_id/.test(message)) {
      throw new WeeklyAssignmentConflict("desk_dow");
    }
    if (/UNIQUE.*weekly_assignments\.user_id/.test(message)) {
      throw new WeeklyAssignmentConflict("user_dow");
    }
    throw e;
  }
}

export function findWeeklyById(db: DatabaseSync, id: number): WeeklyAssignmentRow | null {
  return (
    (db.prepare("SELECT * FROM weekly_assignments WHERE id = ?").get(id) as unknown as
      | WeeklyAssignmentRow
      | undefined) ?? null
  );
}

export function deleteWeeklyById(db: DatabaseSync, id: number): boolean {
  const r = db.prepare("DELETE FROM weekly_assignments WHERE id = ?").run(id);
  return r.changes > 0;
}

export function findByDeskAndDow(
  db: DatabaseSync,
  deskId: number,
  dow: number,
): WeeklyAssignmentRow | null {
  return (
    (db
      .prepare("SELECT * FROM weekly_assignments WHERE desk_id = ? AND dow = ?")
      .get(deskId, dow) as unknown as WeeklyAssignmentRow | undefined) ?? null
  );
}

export interface WeeklyAssignmentDetail {
  id: number;
  desk: { id: number; label: string };
  user: { id: number; name: string; email: string; avatar_url: string | null };
  dow: number;
  created_at: string;
}

export function listByOffice(db: DatabaseSync, officeId: number): WeeklyAssignmentDetail[] {
  const rows = db
    .prepare(
      `SELECT
         w.id, w.dow, w.created_at,
         d.id AS desk_id, d.label AS desk_label,
         u.id AS user_id, u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
       FROM weekly_assignments w
       JOIN desks d ON d.id = w.desk_id
       JOIN users u ON u.id = w.user_id
       WHERE d.office_id = ?
       ORDER BY d.label, w.dow`,
    )
    .all(officeId) as Array<{
    id: number;
    dow: number;
    created_at: string;
    desk_id: number;
    desk_label: string;
    user_id: number;
    user_name: string;
    user_email: string;
    user_avatar_url: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    desk: { id: r.desk_id, label: r.desk_label },
    user: { id: r.user_id, name: r.user_name, email: r.user_email, avatar_url: r.user_avatar_url },
    dow: r.dow,
    created_at: r.created_at,
  }));
}

/**
 * Devuelve la weekly activa para `(deskId, isoDate)`, considerando excepciones.
 * Null si no hay weekly o si la fecha está exceptuada.
 */
export function findActiveForDeskDate(
  db: DatabaseSync,
  deskId: number,
  isoDate: string,
  dow: number,
): WeeklyAssignmentRow | null {
  const row = db
    .prepare(
      `SELECT w.* FROM weekly_assignments w
       WHERE w.desk_id = ? AND w.dow = ?
         AND NOT EXISTS (
           SELECT 1 FROM weekly_assignment_exceptions e
           WHERE e.weekly_assignment_id = w.id AND e.date = ?
         )`,
    )
    .get(deskId, dow, isoDate) as unknown as WeeklyAssignmentRow | undefined;
  return row ?? null;
}

/**
 * Devuelve la weekly activa para `(userId, isoDate)`, considerando excepciones.
 */
export function findActiveForUserDate(
  db: DatabaseSync,
  userId: number,
  isoDate: string,
  dow: number,
): WeeklyAssignmentRow | null {
  const row = db
    .prepare(
      `SELECT w.* FROM weekly_assignments w
       WHERE w.user_id = ? AND w.dow = ?
         AND NOT EXISTS (
           SELECT 1 FROM weekly_assignment_exceptions e
           WHERE e.weekly_assignment_id = w.id AND e.date = ?
         )`,
    )
    .get(userId, dow, isoDate) as unknown as WeeklyAssignmentRow | undefined;
  return row ?? null;
}

/**
 * Lista todas las weeklies activas para una oficina y dow concretos,
 * filtrando excepciones para `isoDate`. Útil para proyectar al detalle de
 * oficina sin N queries.
 */
export function listActiveForOfficeDate(
  db: DatabaseSync,
  officeId: number,
  isoDate: string,
  dow: number,
): WeeklyAssignmentRow[] {
  return db
    .prepare(
      `SELECT w.* FROM weekly_assignments w
       JOIN desks d ON d.id = w.desk_id
       WHERE d.office_id = ? AND w.dow = ?
         AND NOT EXISTS (
           SELECT 1 FROM weekly_assignment_exceptions e
           WHERE e.weekly_assignment_id = w.id AND e.date = ?
         )`,
    )
    .all(officeId, dow, isoDate) as unknown as WeeklyAssignmentRow[];
}

export function createException(
  db: DatabaseSync,
  weeklyAssignmentId: number,
  isoDate: string,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO weekly_assignment_exceptions (weekly_assignment_id, date) VALUES (?, ?)`,
  ).run(weeklyAssignmentId, isoDate);
}
