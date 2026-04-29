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
  },
): UserRow {
  db.prepare(
    `INSERT INTO users (google_sub, email, domain, name, avatar_url, role)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       avatar_url = excluded.avatar_url`,
  ).run(data.google_sub, data.email, data.domain, data.name, data.avatar_url ?? null, data.role);

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
