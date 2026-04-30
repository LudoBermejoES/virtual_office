import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../../../support/db.js";
import {
  createFixedAssignment,
  FixedAssignmentConflict,
} from "../../../../src/infra/repos/fixed-assignments.js";
import type { TestDb } from "../../../support/db.js";

describe("fixed-assignments repo — UNIQUE", () => {
  let testDb: TestDb;
  let userId1: number;
  let userId2: number;
  let deskId1: number;
  let deskId2: number;
  let adminId: number;

  beforeEach(() => {
    testDb = setupTestDb();
    const oRes = testDb.db
      .prepare(
        `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("HQ", "map.tmj", 32, 32, 25, 19, 800, 608);
    const officeId = Number(oRes.lastInsertRowid);

    const u1 = testDb.db
      .prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)")
      .run("u1", "alice@teimas.com", "teimas.com", "Alice", "admin");
    adminId = Number(u1.lastInsertRowid);
    userId1 = adminId;

    const u2 = testDb.db
      .prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)")
      .run("u2", "bob@teimas.com", "teimas.com", "Bob", "member");
    userId2 = Number(u2.lastInsertRowid);

    const d1 = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, "A1", 100, 100, "manual");
    deskId1 = Number(d1.lastInsertRowid);
    const d2 = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, "A2", 200, 200, "manual");
    deskId2 = Number(d2.lastInsertRowid);
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("propaga UNIQUE(desk_id) como FixedAssignmentConflict('desk_id')", () => {
    createFixedAssignment(testDb.db, {
      desk_id: deskId1,
      user_id: userId1,
      assigned_by_user_id: adminId,
    });
    try {
      createFixedAssignment(testDb.db, {
        desk_id: deskId1,
        user_id: userId2,
        assigned_by_user_id: adminId,
      });
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(FixedAssignmentConflict);
      expect((e as FixedAssignmentConflict).column).toBe("desk_id");
    }
  });

  it("propaga UNIQUE(user_id) como FixedAssignmentConflict('user_id')", () => {
    createFixedAssignment(testDb.db, {
      desk_id: deskId1,
      user_id: userId2,
      assigned_by_user_id: adminId,
    });
    try {
      createFixedAssignment(testDb.db, {
        desk_id: deskId2,
        user_id: userId2,
        assigned_by_user_id: adminId,
      });
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(FixedAssignmentConflict);
      expect((e as FixedAssignmentConflict).column).toBe("user_id");
    }
  });
});
