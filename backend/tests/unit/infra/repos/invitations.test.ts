import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../../../support/db.js";
import * as invRepo from "../../../../src/infra/repos/invitations.js";
import type { TestDb } from "../../../support/db.js";

describe("invitations repo", () => {
  let testDb: TestDb;
  let adminId: number;

  beforeEach(() => {
    testDb = setupTestDb();
    testDb.db
      .prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)")
      .run("admin-sub", "admin@teimas.com", "teimas.com", "Admin", "admin");
    adminId = (
      testDb.db.prepare("SELECT id FROM users WHERE email = ?").get("admin@teimas.com") as {
        id: number;
      }
    ).id;
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("findById devuelve la fila o null", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const created = invRepo.create(testDb.db, {
      email: "x@externo.com",
      invited_by_user_id: adminId,
      token: "tok-x",
      expires_at: future,
    });
    expect(invRepo.findById(testDb.db, created.id)?.token).toBe("tok-x");
    expect(invRepo.findById(testDb.db, 9999)).toBeNull();
  });

  it("findLiveByEmail devuelve la viva o null si caducada", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    const now = new Date();

    invRepo.create(testDb.db, {
      email: "viva@externo.com",
      invited_by_user_id: adminId,
      token: "tok-viva",
      expires_at: future,
    });
    invRepo.create(testDb.db, {
      email: "muerta@externo.com",
      invited_by_user_id: adminId,
      token: "tok-muerta",
      expires_at: past,
    });

    expect(invRepo.findLiveByEmail(testDb.db, "viva@externo.com", now)?.token).toBe("tok-viva");
    expect(invRepo.findLiveByEmail(testDb.db, "muerta@externo.com", now)).toBeNull();
    expect(invRepo.findLiveByEmail(testDb.db, "no-existe@externo.com", now)).toBeNull();
  });

  it("markAccepted setea accepted_at", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const created = invRepo.create(testDb.db, {
      email: "y@externo.com",
      invited_by_user_id: adminId,
      token: "tok-y",
      expires_at: future,
    });
    invRepo.markAccepted(testDb.db, created.id, "2026-04-29T10:00:00.000Z");
    expect(invRepo.findById(testDb.db, created.id)?.accepted_at).toBe("2026-04-29T10:00:00.000Z");
  });

  it("listAll devuelve todas independientemente de estado", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    invRepo.create(testDb.db, {
      email: "a@externo.com",
      invited_by_user_id: adminId,
      token: "ta",
      expires_at: future,
    });
    invRepo.create(testDb.db, {
      email: "b@externo.com",
      invited_by_user_id: adminId,
      token: "tb",
      expires_at: past,
    });
    expect(invRepo.listAll(testDb.db)).toHaveLength(2);
  });
});
