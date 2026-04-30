import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import type { TestDb } from "../support/db.js";

describe("migración 0002 bookings indexes", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("tras correr migraciones existe el índice idx_bookings_user_date_daily", () => {
    const row = testDb.db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND name=?")
      .get("idx_bookings_user_date_daily") as { name: string; sql: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.sql).toContain("type='daily'");
  });
});
