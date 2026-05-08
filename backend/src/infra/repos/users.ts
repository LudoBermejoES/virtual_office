import type { DatabaseSync } from "node:sqlite";
import type { UserRole } from "@virtual-office/shared";

export interface UserRow {
  id: number;
  google_sub: string;
  email: string;
  domain: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  is_invited_external: number;
  created_at: string;
  /** Cuando es 1, el upsert de Google login NO machaca `avatar_url` (change 030). */
  avatar_locked: number;
}

export function setAvatarLocked(
  db: DatabaseSync,
  userId: number,
  avatarUrl: string | null,
  locked: 0 | 1,
): void {
  db.prepare("UPDATE users SET avatar_url = ?, avatar_locked = ? WHERE id = ?").run(
    avatarUrl,
    locked,
    userId,
  );
}

export function upsertUser(
  db: DatabaseSync,
  data: {
    google_sub: string;
    email: string;
    domain: string;
    name: string;
    avatar_url?: string | undefined;
    role: UserRole;
    is_invited_external?: number;
  },
): UserRow {
  // `avatar_url` solo se actualiza si `users.avatar_locked = 0`. Cuando un
  // admin sube un avatar custom (change 030) ponemos `avatar_locked = 1` para
  // que el siguiente login de Google no machaque la URL `/avatars/...`.
  db.prepare(
    `INSERT INTO users (google_sub, email, domain, name, avatar_url, role, is_invited_external)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       avatar_url = CASE WHEN users.avatar_locked = 1 THEN users.avatar_url ELSE excluded.avatar_url END`,
  ).run(
    data.google_sub,
    data.email,
    data.domain,
    data.name,
    data.avatar_url ?? null,
    data.role,
    data.is_invited_external ?? 0,
  );

  return db
    .prepare("SELECT * FROM users WHERE google_sub = ?")
    .get(data.google_sub) as unknown as UserRow;
}

export function promoteToAdmin(db: DatabaseSync, email: string): void {
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
}

export function findUserById(db: DatabaseSync, id: number): UserRow | null {
  return (
    (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as UserRow | undefined) ??
    null
  );
}

export function listUsers(db: DatabaseSync): UserRow[] {
  return db.prepare("SELECT * FROM users ORDER BY created_at ASC").all() as unknown as UserRow[];
}

export function findUserByEmail(db: DatabaseSync, email: string): UserRow | null {
  return (
    (db.prepare("SELECT * FROM users WHERE email = ?").get(email) as unknown as
      | UserRow
      | undefined) ?? null
  );
}

export function updateUserRole(db: DatabaseSync, id: number, role: UserRole): void {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}
