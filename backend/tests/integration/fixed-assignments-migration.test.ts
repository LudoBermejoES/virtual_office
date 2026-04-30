import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import type { TestDb } from "../support/db.js";

describe("migración 0003 fixed_assignments", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("tabla existe con UNIQUE en desk_id y user_id", () => {
    const tbl = testDb.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='fixed_assignments'")
      .get() as { sql: string } | undefined;
    expect(tbl).toBeDefined();
    expect(tbl!.sql).toContain("desk_id INTEGER NOT NULL UNIQUE");
    expect(tbl!.sql).toContain("user_id INTEGER NOT NULL UNIQUE");
  });
});
