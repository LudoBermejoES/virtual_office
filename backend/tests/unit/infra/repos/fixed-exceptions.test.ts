import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../../../support/db.js";
import {
  createException,
  deleteException,
  findException,
  listExceptionsByOfficeAndDate,
  findUserExceptionForDate,
} from "../../../../src/infra/repos/fixed-exceptions.js";
import type { TestDb } from "../../../support/db.js";

describe("fixed-exceptions repo", () => {
  let testDb: TestDb;
  let fixedId: number;
  let userId: number;
  let officeId: number;

  beforeEach(() => {
    testDb = setupTestDb();
    const oRes = testDb.db
      .prepare(
        `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("HQ", "map.tmj", 32, 32, 25, 19, 800, 608);
    officeId = Number(oRes.lastInsertRowid);

    const u = testDb.db
      .prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)")
      .run("u1", "alice@teimas.com", "teimas.com", "Alice", "admin");
    userId = Number(u.lastInsertRowid);

    const d = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, "D1", 100, 100, "manual");
    const deskId = Number(d.lastInsertRowid);

    const f = testDb.db
      .prepare(
        "INSERT INTO fixed_assignments (desk_id, user_id, assigned_by_user_id) VALUES (?, ?, ?)",
      )
      .run(deskId, userId, userId);
    fixedId = Number(f.lastInsertRowid);
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("createException inserta y retorna fila", () => {
    const exc = createException(testDb.db, fixedId, "2026-05-10", userId);
    expect(exc).toMatchObject({
      fixed_assignment_id: fixedId,
      date: "2026-05-10",
      created_by_user_id: userId,
    });
    expect(exc.id).toBeGreaterThan(0);
  });

  it("createException con duplicado retorna fila existente sin error", () => {
    const first = createException(testDb.db, fixedId, "2026-05-10", userId);
    const second = createException(testDb.db, fixedId, "2026-05-10", userId);
    expect(second.id).toBe(first.id);
  });

  it("deleteException retorna true si borró", () => {
    createException(testDb.db, fixedId, "2026-05-10", userId);
    expect(deleteException(testDb.db, fixedId, "2026-05-10")).toBe(true);
    expect(findException(testDb.db, fixedId, "2026-05-10")).toBeNull();
  });

  it("deleteException retorna false si no existía", () => {
    expect(deleteException(testDb.db, fixedId, "2026-05-10")).toBe(false);
  });

  it("findException retorna fila o null", () => {
    expect(findException(testDb.db, fixedId, "2026-05-10")).toBeNull();
    createException(testDb.db, fixedId, "2026-05-10", userId);
    expect(findException(testDb.db, fixedId, "2026-05-10")).not.toBeNull();
  });

  it("listExceptionsByOfficeAndDate retorna excepciones para esa oficina y fecha", () => {
    createException(testDb.db, fixedId, "2026-05-10", userId);
    createException(testDb.db, fixedId, "2026-05-11", userId);

    const onDay = listExceptionsByOfficeAndDate(testDb.db, officeId, "2026-05-10");
    expect(onDay).toHaveLength(1);
    expect(onDay[0]!.fixed_assignment_id).toBe(fixedId);
    expect(onDay[0]!.date).toBe("2026-05-10");

    const otherDay = listExceptionsByOfficeAndDate(testDb.db, officeId, "2026-05-12");
    expect(otherDay).toHaveLength(0);
  });

  it("findUserExceptionForDate retorna desk_id si el usuario tiene excepción ese día", () => {
    createException(testDb.db, fixedId, "2026-05-10", userId);
    const result = findUserExceptionForDate(testDb.db, userId, officeId, "2026-05-10");
    expect(result).not.toBeNull();
    expect(result!.fixed_assignment_id).toBe(fixedId);
  });

  it("findUserExceptionForDate retorna null si no hay excepción", () => {
    const result = findUserExceptionForDate(testDb.db, userId, officeId, "2026-05-10");
    expect(result).toBeNull();
  });

  it("CASCADE: borrar fixed_assignment elimina sus excepciones", () => {
    createException(testDb.db, fixedId, "2026-05-10", userId);
    testDb.db.prepare("DELETE FROM fixed_assignments WHERE id = ?").run(fixedId);
    expect(findException(testDb.db, fixedId, "2026-05-10")).toBeNull();
  });
});
