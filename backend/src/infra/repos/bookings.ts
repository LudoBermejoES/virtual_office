import type { DatabaseSync } from "node:sqlite";

export type BookingType = "daily" | "fixed";

export interface BookingRow {
  id: number;
  desk_id: number;
  user_id: number;
  date: string;
  type: BookingType;
  created_at: string;
}

export class UniqueViolation extends Error {
  constructor(public readonly column: "desk_id_date" | "user_id_date") {
    super(`unique violation: ${column}`);
  }
}

export function createBooking(
  db: DatabaseSync,
  data: { desk_id: number; user_id: number; date: string; type: BookingType },
): BookingRow {
  try {
    const result = db
      .prepare(`INSERT INTO bookings (desk_id, user_id, date, type) VALUES (?, ?, ?, ?)`)
      .run(data.desk_id, data.user_id, data.date, data.type);
    return findById(db, Number(result.lastInsertRowid))!;
  } catch (e) {
    const message = (e as Error).message ?? "";
    if (/UNIQUE.*bookings\.desk_id.*bookings\.date/.test(message)) {
      throw new UniqueViolation("desk_id_date");
    }
    if (/idx_bookings_user_date_daily/.test(message) || /UNIQUE.*user_id.*date/.test(message)) {
      throw new UniqueViolation("user_id_date");
    }
    throw e;
  }
}

export function deleteBy(db: DatabaseSync, data: { desk_id: number; date: string }): void {
  db.prepare("DELETE FROM bookings WHERE desk_id = ? AND date = ?").run(data.desk_id, data.date);
}

export function findBy(
  db: DatabaseSync,
  data: { desk_id: number; date: string },
): BookingRow | null {
  return (
    (db
      .prepare("SELECT * FROM bookings WHERE desk_id = ? AND date = ?")
      .get(data.desk_id, data.date) as unknown as BookingRow | undefined) ?? null
  );
}

export function findById(db: DatabaseSync, id: number): BookingRow | null {
  return (
    (db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as unknown as
      | BookingRow
      | undefined) ?? null
  );
}

export interface BookingWithUser extends BookingRow {
  userName: string;
  userAvatarUrl: string | null;
}

export function listByOfficeAndDate(
  db: DatabaseSync,
  officeId: number,
  date: string,
): BookingWithUser[] {
  const rows = db
    .prepare(
      `SELECT b.*, u.name AS userName, u.avatar_url AS userAvatarUrl
         FROM bookings b
         JOIN desks d ON d.id = b.desk_id
         JOIN users u ON u.id = b.user_id
         WHERE d.office_id = ? AND b.date = ?`,
    )
    .all(officeId, date) as unknown as BookingWithUser[];
  return rows;
}

export function findUserBookingOnDate(
  db: DatabaseSync,
  userId: number,
  date: string,
  type: BookingType = "daily",
): BookingRow | null {
  return (
    (db
      .prepare("SELECT * FROM bookings WHERE user_id = ? AND date = ? AND type = ?")
      .get(userId, date, type) as unknown as BookingRow | undefined) ?? null
  );
}
