/**
 * Tests integración de los endpoints CRUD de weekly_assignments (change 027).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import * as fixedRepo from "../../src/infra/repos/fixed-assignments.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
  });
}

async function loginAs(
  server: TestServer,
  verifier: FakeGoogleVerifier,
  email: string,
  sub: string,
): Promise<string> {
  verifier.setNextPayload({
    sub,
    email,
    hd: "teimas.com",
    name: email.split("@")[0],
    iss: "accounts.google.com",
    email_verified: true,
  } as never);
  const res = await server.app.inject({
    method: "POST",
    url: "/api/auth/google",
    body: { idToken: "fake" },
  });
  const cookieHeader = res.headers["set-cookie"];
  const raw = Array.isArray(cookieHeader) ? (cookieHeader[0] ?? "") : String(cookieHeader ?? "");
  return raw.split(";")[0] ?? "";
}

function getUserIdByEmail(testDb: TestDb, email: string): number {
  const row = testDb.db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`user ${email} not found`);
  return row.id;
}

function seedOfficeAndDesks(testDb: TestDb): {
  officeId: number;
  deskIds: number[];
} {
  const oRes = testDb.db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", "map.tmj", 32, 32, 10, 10, 320, 320);
  const officeId = Number(oRes.lastInsertRowid);
  const deskIds = [1, 2, 3].map((i) => {
    const r = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, `D${String(i)}`, i * 100, 100, "manual");
    return Number(r.lastInsertRowid);
  });
  return { officeId, deskIds };
}

describe("POST /api/desks/:id/weekly", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let aliceId: number;
  let bobId: number;
  let deskIds: number[];

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-weekly-ep-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    aliceId = getUserIdByEmail(testDb, "alice@teimas.com");
    bobId = getUserIdByEmail(testDb, "bob@teimas.com");
    ({ deskIds } = seedOfficeAndDesks(testDb));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("admin crea weekly válido → 201", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 0 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{
      weekly: { id: number; desk_id: number; user_id: number; dow: number };
    }>();
    expect(body.weekly.user_id).toBe(bobId);
    expect(body.weekly.dow).toBe(0);
  });

  it("no-admin → 403", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: bobCookie },
      payload: { userId: aliceId, dow: 0 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("dow fuera de rango → 400", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 7 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("userId que no existe → 404 user_not_found", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: 99999, dow: 0 },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ reason: string }>().reason).toBe("user_not_found");
  });

  it("desk con fixed → 409 desk_has_fixed_assignment", async () => {
    fixedRepo.createFixedAssignment(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      assigned_by_user_id: aliceId,
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 0 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ reason: string }>().reason).toBe("desk_has_fixed_assignment");
  });

  it("desk_dow conflict → 409 weekly_dow_conflict", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 0 },
    });
    const r2 = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: aliceId, dow: 0 },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json<{ reason: string }>().reason).toBe("weekly_dow_conflict");
  });

  it("user_dow conflict (mismo user, mismo dow, otro desk) → 409 user_dow_conflict", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 0 },
    });
    const r2 = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[1]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 0 },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json<{ reason: string }>().reason).toBe("user_dow_conflict");
  });
});

describe("DELETE /api/desks/:id/weekly/:weeklyId", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let aliceId: number;
  let bobId: number;
  let deskIds: number[];
  let weeklyId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-weekly-del-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    aliceId = getUserIdByEmail(testDb, "alice@teimas.com");
    bobId = getUserIdByEmail(testDb, "bob@teimas.com");
    ({ deskIds } = seedOfficeAndDesks(testDb));
    const r = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 0 },
    });
    weeklyId = r.json<{ weekly: { id: number } }>().weekly.id;
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("admin borra weekly → 204", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(204);
  });

  it("no-admin → 403", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}`,
      headers: { cookie: bobCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(aliceId).toBeGreaterThan(0); // shut up linter
  });

  it("weeklyId no pertenece al desk → 404", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[1]}/weekly/${weeklyId}`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/offices/:id/weekly", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let bobId: number;
  let officeId: number;
  let deskIds: number[];

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-weekly-get-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    bobId = getUserIdByEmail(testDb, "bob@teimas.com");
    ({ officeId, deskIds } = seedOfficeAndDesks(testDb));
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 0 },
    });
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[1]}/weekly`,
      headers: { cookie: aliceCookie },
      payload: { userId: bobId, dow: 3 },
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("admin recibe array de weeklies enriquecidos", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}/weekly`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<
      Array<{ id: number; desk: { label: string }; user: { name: string }; dow: number }>
    >();
    expect(body).toHaveLength(2);
    expect(body[0]!.desk.label).toBe("D1");
    expect(body[0]!.user.name).toBe("bob");
  });

  it("no-admin → 403", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}/weekly`,
      headers: { cookie: bobCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
