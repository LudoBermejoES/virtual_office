import type { DatabaseSync } from "node:sqlite";
import { isLive } from "../../domain/invitations.js";

export interface InvitationRow {
  id: number;
  email: string;
  invited_by_user_id: number;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export function create(
  db: DatabaseSync,
  data: {
    email: string;
    invited_by_user_id: number;
    token: string;
    expires_at: string;
  },
): InvitationRow {
  db.prepare(
    `INSERT INTO invitations (email, invited_by_user_id, token, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(data.email, data.invited_by_user_id, data.token, data.expires_at);

  return db
    .prepare("SELECT * FROM invitations WHERE email = ?")
    .get(data.email) as unknown as InvitationRow;
}

export function renew(
  db: DatabaseSync,
  data: { email: string; token: string; expires_at: string; invited_by_user_id: number },
): InvitationRow {
  db.prepare(
    `UPDATE invitations
     SET token = ?, expires_at = ?, accepted_at = NULL, invited_by_user_id = ?
     WHERE email = ?`,
  ).run(data.token, data.expires_at, data.invited_by_user_id, data.email);

  return db
    .prepare("SELECT * FROM invitations WHERE email = ?")
    .get(data.email) as unknown as InvitationRow;
}

export function findById(db: DatabaseSync, id: number): InvitationRow | null {
  return (
    (db.prepare("SELECT * FROM invitations WHERE id = ?").get(id) as unknown | undefined as
      | InvitationRow
      | undefined) ?? null
  );
}

export function findByEmail(db: DatabaseSync, email: string): InvitationRow | null {
  return (
    (db.prepare("SELECT * FROM invitations WHERE email = ?").get(email) as unknown | undefined as
      | InvitationRow
      | undefined) ?? null
  );
}

export function findLiveByEmail(db: DatabaseSync, email: string, now: Date): InvitationRow | null {
  const row = findByEmail(db, email);
  if (!row) return null;
  return isLive(row, now) ? row : null;
}

export function findByToken(db: DatabaseSync, token: string): InvitationRow | null {
  return (
    (db.prepare("SELECT * FROM invitations WHERE token = ?").get(token) as unknown | undefined as
      | InvitationRow
      | undefined) ?? null
  );
}

export function markAccepted(db: DatabaseSync, id: number, acceptedAt: string): void {
  db.prepare("UPDATE invitations SET accepted_at = ? WHERE id = ?").run(acceptedAt, id);
}

export function renewById(
  db: DatabaseSync,
  id: number,
  data: { token: string; expires_at: string },
): InvitationRow | null {
  db.prepare(
    `UPDATE invitations SET token = ?, expires_at = ?, accepted_at = NULL WHERE id = ?`,
  ).run(data.token, data.expires_at, id);
  return findById(db, id);
}

export function revoke(db: DatabaseSync, id: number, now: string): void {
  db.prepare("UPDATE invitations SET expires_at = ? WHERE id = ?").run(now, id);
}

export function listLive(db: DatabaseSync, now: Date): InvitationRow[] {
  const rows = db
    .prepare("SELECT * FROM invitations ORDER BY created_at DESC")
    .all() as unknown as InvitationRow[];
  return rows.filter((r) => isLive(r, now));
}

export function listAll(db: DatabaseSync): InvitationRow[] {
  return db
    .prepare("SELECT * FROM invitations ORDER BY created_at DESC")
    .all() as unknown as InvitationRow[];
}
