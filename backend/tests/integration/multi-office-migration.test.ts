import { describe, it, expect } from "vitest";
import { setupTestDb } from "../support/db.js";
import { runMigrations } from "../../src/infra/db/migrations.js";

describe("migración 0006_multi_office", () => {
  it("añade users.default_office_id y crea office_admins", () => {
    const { db, cleanup } = setupTestDb();

    const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const userColNames = userCols.map((c) => c.name);
    expect(userColNames).toContain("default_office_id");

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='office_admins'")
      .all() as { name: string }[];
    expect(tables).toHaveLength(1);

    const adminCols = db.prepare("PRAGMA table_info(office_admins)").all() as { name: string }[];
    const adminColNames = adminCols.map((c) => c.name);
    expect(adminColNames).toContain("office_id");
    expect(adminColNames).toContain("user_id");
    expect(adminColNames).toContain("granted_by");
    expect(adminColNames).toContain("granted_at");

    // Idempotente
    expect(() => runMigrations(db)).not.toThrow();

    cleanup();
  });

  it("default_office_id acepta NULL y FK a offices", () => {
    const { db, cleanup } = setupTestDb();

    db.prepare(
      "INSERT INTO users (google_sub, email, domain, name, role, default_office_id) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("sub-alice", "alice@test.com", "test.com", "Alice", "member", null);

    const row = db
      .prepare("SELECT default_office_id FROM users WHERE email=?")
      .get("alice@test.com") as { default_office_id: number | null };
    expect(row.default_office_id).toBeNull();

    cleanup();
  });

  it("office_admins PK compuesta (office_id, user_id) rechaza duplicados", () => {
    const { db, cleanup } = setupTestDb();

    db.prepare(
      "INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?,?,?,?,?,?,?,?)",
    ).run("Oficina1", "map.tmj", 32, 32, 10, 10, 320, 320);
    db.prepare(
      "INSERT INTO users (google_sub, email, domain, name, role) VALUES (?,?,?,?,?)",
    ).run("sub-bob", "bob@test.com", "test.com", "Bob", "member");

    const officeId = (
      db.prepare("SELECT id FROM offices WHERE name='Oficina1'").get() as { id: number }
    ).id;
    const userId = (
      db.prepare("SELECT id FROM users WHERE email='bob@test.com'").get() as { id: number }
    ).id;

    db.prepare("INSERT INTO office_admins (office_id, user_id) VALUES (?, ?)").run(officeId, userId);

    expect(() =>
      db.prepare("INSERT INTO office_admins (office_id, user_id) VALUES (?, ?)").run(officeId, userId),
    ).toThrow();

    cleanup();
  });
});
