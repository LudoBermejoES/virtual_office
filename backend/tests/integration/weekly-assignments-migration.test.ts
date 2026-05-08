import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import type { TestDb } from "../support/db.js";

describe("migración 0008 weekly_assignments", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("tabla weekly_assignments existe con UNIQUE(desk_id, dow) y UNIQUE(user_id, dow)", () => {
    const tbl = testDb.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='weekly_assignments'")
      .get() as { sql: string } | undefined;
    expect(tbl).toBeDefined();
    expect(tbl!.sql).toContain("desk_id INTEGER NOT NULL");
    expect(tbl!.sql).toContain("user_id INTEGER NOT NULL");
    expect(tbl!.sql).toContain("dow INTEGER NOT NULL");
    expect(tbl!.sql).toContain("UNIQUE (desk_id, dow)");
    expect(tbl!.sql).toContain("UNIQUE (user_id, dow)");
    expect(tbl!.sql).toContain("ON DELETE CASCADE");
  });

  it("CHECK dow rango 0..6 funciona", () => {
    // Necesitamos un desk + user para insertar.
    testDb.db
      .prepare(
        `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("HQ", "map.tmj", 32, 32, 10, 10, 320, 320);
    testDb.db
      .prepare(
        `INSERT INTO users (google_sub, email, domain, name, role, is_invited_external) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("sub-1", "u@teimas.com", "teimas.com", "U", "member", 0);
    testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(1, "D1", 0, 0, "manual");

    expect(() =>
      testDb.db
        .prepare(
          "INSERT INTO weekly_assignments (desk_id, user_id, dow, created_by_user_id) VALUES (?, ?, ?, ?)",
        )
        .run(1, 1, 7, 1),
    ).toThrow();

    expect(() =>
      testDb.db
        .prepare(
          "INSERT INTO weekly_assignments (desk_id, user_id, dow, created_by_user_id) VALUES (?, ?, ?, ?)",
        )
        .run(1, 1, -1, 1),
    ).toThrow();

    // 0..6 sí
    testDb.db
      .prepare(
        "INSERT INTO weekly_assignments (desk_id, user_id, dow, created_by_user_id) VALUES (?, ?, ?, ?)",
      )
      .run(1, 1, 0, 1);
  });

  it("tabla weekly_assignment_exceptions existe con UNIQUE(weekly_assignment_id, date)", () => {
    const tbl = testDb.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='weekly_assignment_exceptions'",
      )
      .get() as { sql: string } | undefined;
    expect(tbl).toBeDefined();
    expect(tbl!.sql).toContain("weekly_assignment_id INTEGER NOT NULL");
    expect(tbl!.sql).toContain("date TEXT NOT NULL");
    expect(tbl!.sql).toContain("UNIQUE (weekly_assignment_id, date)");
    expect(tbl!.sql).toContain("ON DELETE CASCADE");
  });

  it("indices existen", () => {
    const idxs = testDb.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_weekly_assignments_desk_dow', 'idx_weekly_assignments_user_dow', 'idx_weekly_exceptions_date')",
      )
      .all() as Array<{ name: string }>;
    expect(idxs.map((r) => r.name).sort()).toEqual([
      "idx_weekly_assignments_desk_dow",
      "idx_weekly_assignments_user_dow",
      "idx_weekly_exceptions_date",
    ]);
  });
});
