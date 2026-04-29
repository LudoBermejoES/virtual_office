import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

export interface SeededUsers {
  alice: { id: number; email: string; google_sub: string };
  bob: { id: number; email: string; google_sub: string };
  admin: { id: number; email: string; google_sub: string };
}

export function seedUsers(db: DatabaseSync): SeededUsers {
  const insert = db.prepare(
    `INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)`,
  );

  const aliceSub = randomUUID();
  const bobSub = randomUUID();
  const adminSub = randomUUID();

  insert.run(aliceSub, "alice@teimas.com", "teimas.com", "Alice", "member");
  insert.run(bobSub, "bob@teimas.com", "teimas.com", "Bob", "member");
  insert.run(adminSub, "admin@teimas.com", "teimas.com", "Admin", "admin");

  const get = (sub: string) =>
    db.prepare("SELECT id, email, google_sub FROM users WHERE google_sub = ?").get(sub) as {
      id: number;
      email: string;
      google_sub: string;
    };

  return { alice: get(aliceSub), bob: get(bobSub), admin: get(adminSub) };
}
