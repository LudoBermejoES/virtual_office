import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../../../support/db.js";
import {
  createBooking,
  UniqueViolation,
} from "../../../../src/infra/repos/bookings.js";
import type { TestDb } from "../../../support/db.js";

describe("bookings repo — create propagates UNIQUE constraint", () => {
  let testDb: TestDb;
  let officeId: number;
  let userId: number;
  let userId2: number;
  let deskId: number;
  let deskId2: number;

  beforeEach(() => {
    testDb = setupTestDb();
    const oRes = testDb.db
      .prepare(
        `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("HQ", "map.tmj", 32, 32, 25, 19, 800, 608);
    officeId = Number(oRes.lastInsertRowid);

    const u1 = testDb.db
      .prepare(
        "INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)",
      )
      .run("alice-sub", "alice@teimas.com", "teimas.com", "Alice", "member");
    userId = Number(u1.lastInsertRowid);
    const u2 = testDb.db
      .prepare(
        "INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)",
      )
      .run("bob-sub", "bob@teimas.com", "teimas.com", "Bob", "member");
    userId2 = Number(u2.lastInsertRowid);

    const d1 = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, "A1", 100, 100, "manual");
    deskId = Number(d1.lastInsertRowid);
    const d2 = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, "A2", 200, 200, "manual");
    deskId2 = Number(d2.lastInsertRowid);
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("propaga UNIQUE(desk_id, date) como UniqueViolation('desk_id_date')", () => {
    createBooking(testDb.db, { desk_id: deskId, user_id: userId, date: "2026-05-04", type: "daily" });
    try {
      createBooking(testDb.db, {
        desk_id: deskId,
        user_id: userId2,
        date: "2026-05-04",
        type: "daily",
      });
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UniqueViolation);
      expect((e as UniqueViolation).column).toBe("desk_id_date");
    }
  });

  it("propaga UNIQUE(user_id, date) WHERE type=daily como UniqueViolation('user_id_date')", () => {
    createBooking(testDb.db, { desk_id: deskId, user_id: userId, date: "2026-05-04", type: "daily" });
    try {
      createBooking(testDb.db, {
        desk_id: deskId2,
        user_id: userId,
        date: "2026-05-04",
        type: "daily",
      });
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UniqueViolation);
      expect((e as UniqueViolation).column).toBe("user_id_date");
    }
  });
});
