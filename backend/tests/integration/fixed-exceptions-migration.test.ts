import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import type { TestDb } from "../support/db.js";

describe("migración 0007 fixed_assignment_exceptions", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("tabla existe con UNIQUE(fixed_assignment_id, date) y FK CASCADE", () => {
    const tbl = testDb.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='fixed_assignment_exceptions'",
      )
      .get() as { sql: string } | undefined;
    expect(tbl).toBeDefined();
    expect(tbl!.sql).toContain("fixed_assignment_id INTEGER NOT NULL");
    expect(tbl!.sql).toContain("date TEXT NOT NULL");
    expect(tbl!.sql).toContain("UNIQUE (fixed_assignment_id, date)");
    expect(tbl!.sql).toContain("ON DELETE CASCADE");
  });

  it("indice idx_fixed_exceptions_date existe", () => {
    const idx = testDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_fixed_exceptions_date'")
      .get() as { name: string } | undefined;
    expect(idx).toBeDefined();
  });
});
