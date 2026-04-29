import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

interface User {
  id: number;
  google_sub: string;
  email: string;
  domain: string;
  name: string;
  avatar_url: string | null;
  role: "admin" | "member";
  is_invited_external: number;
}

interface Office {
  id: number;
  name: string;
  tmj_filename: string;
  tile_width: number;
  tile_height: number;
  cells_x: number;
  cells_y: number;
  map_width: number;
  map_height: number;
}

interface Desk {
  id: number;
  office_id: number;
  label: string;
  x: number;
  y: number;
  source: "manual" | "tiled";
}

interface Booking {
  id: number;
  desk_id: number;
  user_id: number;
  date: string;
  type: "daily" | "fixed";
}

export function userIn(
  db: DatabaseSync,
  domain: string,
  role: "admin" | "member" = "member",
): User {
  const sub = randomUUID();
  const email = `user-${sub.slice(0, 8)}@${domain}`;
  db.prepare(
    `INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)`,
  ).run(sub, email, domain, `User ${sub.slice(0, 4)}`, role);
  return db.prepare("SELECT * FROM users WHERE google_sub = ?").get(sub) as User;
}

export function adminIn(db: DatabaseSync, domain: string): User {
  return userIn(db, domain, "admin");
}

export function invitedExternal(db: DatabaseSync, email: string): User {
  const sub = randomUUID();
  const domain = email.split("@")[1] ?? "external.example.com";
  db.prepare(
    `INSERT INTO users (google_sub, email, domain, name, role, is_invited_external)
     VALUES (?, ?, ?, ?, 'member', 1)`,
  ).run(sub, email, domain, `External ${sub.slice(0, 4)}`);
  return db.prepare("SELECT * FROM users WHERE google_sub = ?").get(sub) as User;
}

export function officeWithMap(db: DatabaseSync, overrides: Partial<Office> = {}): Office {
  const name = overrides.name ?? `Office ${randomUUID().slice(0, 6)}`;
  db.prepare(
    `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    name,
    overrides.tmj_filename ?? "map.tmj",
    overrides.tile_width ?? 32,
    overrides.tile_height ?? 32,
    overrides.cells_x ?? 20,
    overrides.cells_y ?? 15,
    overrides.map_width ?? 640,
    overrides.map_height ?? 480,
  );
  return db.prepare("SELECT * FROM offices WHERE name = ?").get(name) as Office;
}

export function deskAt(
  db: DatabaseSync,
  officeId: number,
  x: number,
  y: number,
  label?: string,
): Desk {
  const deskLabel = label ?? `Desk-${randomUUID().slice(0, 6)}`;
  db.prepare(
    `INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, 'manual')`,
  ).run(officeId, deskLabel, x, y);
  return db.prepare("SELECT * FROM desks WHERE office_id = ? AND label = ?").get(
    officeId,
    deskLabel,
  ) as Desk;
}

export function bookingFor(
  db: DatabaseSync,
  userId: number,
  deskId: number,
  date: string,
  type: "daily" | "fixed" = "daily",
): Booking {
  db.prepare(
    `INSERT INTO bookings (desk_id, user_id, date, type) VALUES (?, ?, ?, ?)`,
  ).run(deskId, userId, date, type);
  return db
    .prepare("SELECT * FROM bookings WHERE desk_id = ? AND user_id = ? AND date = ?")
    .get(deskId, userId, date) as Booking;
}
