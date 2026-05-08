/**
 * Tests integración del change 028: endpoints POST/DELETE de excepciones de
 * weekly_assignments. Pueden actuar el dueño de la weekly o un admin de la
 * oficina.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import * as weeklyRepo from "../../src/infra/repos/weekly-assignments.js";
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

function seed(testDb: TestDb): { officeId: number; deskIds: number[] } {
  const oRes = testDb.db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", "map.tmj", 32, 32, 10, 10, 320, 320);
  const officeId = Number(oRes.lastInsertRowid);
  const deskIds = [1, 2].map((i) => {
    const r = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, `D${String(i)}`, i * 100, 100, "manual");
    return Number(r.lastInsertRowid);
  });
  return { officeId, deskIds };
}

const MONDAY = "2026-05-04"; // dow=0
const WEDNESDAY = "2026-05-06"; // dow=2

describe("POST /api/desks/:id/weekly/:weeklyId/exceptions", () => {
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
    mapsDir = mkdtempSync(join(tmpdir(), "vo-weekly-exc-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    aliceId = getUserIdByEmail(testDb, "alice@teimas.com");
    bobId = getUserIdByEmail(testDb, "bob@teimas.com");
    ({ deskIds } = seed(testDb));
    // Bob tiene weekly los lunes en deskIds[0]
    const w = weeklyRepo.createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: bobId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    weeklyId = w.id;
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("dueño de la weekly crea excepción → 201", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: MONDAY },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ exception: { weekly_assignment_id: number; date: string } }>();
    expect(body.exception.weekly_assignment_id).toBe(weeklyId);
    expect(body.exception.date).toBe(MONDAY);
  });

  it("admin crea excepción de la weekly de otro → 201", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: aliceCookie },
      payload: { date: MONDAY },
    });
    expect(res.statusCode).toBe(201);
  });

  it("usuario ajeno (no admin, no dueño) → 403", async () => {
    const charlieCookie = await loginAs(server, verifier, "charlie@teimas.com", "charlie-sub");
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: charlieCookie },
      payload: { date: MONDAY },
    });
    expect(res.statusCode).toBe(403);
  });

  it("date con dow distinto al weekly.dow → 422 date_dow_mismatch", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: WEDNESDAY }, // miércoles, weekly es lunes
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("date_dow_mismatch");
  });

  it("date con formato inválido → 422 invalid_date", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: "no-date" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("excepción duplicada → 409 exception_already_exists", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: MONDAY },
    });
    const r2 = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: MONDAY },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json<{ reason: string }>().reason).toBe("exception_already_exists");
  });

  it("weeklyId no pertenece al desk → 404 weekly_not_found", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[1]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: MONDAY },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ reason: string }>().reason).toBe("weekly_not_found");
  });
});

describe("DELETE /api/desks/:id/weekly/:weeklyId/exceptions", () => {
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
    mapsDir = mkdtempSync(join(tmpdir(), "vo-weekly-exc-del-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    aliceId = getUserIdByEmail(testDb, "alice@teimas.com");
    bobId = getUserIdByEmail(testDb, "bob@teimas.com");
    ({ deskIds } = seed(testDb));
    const w = weeklyRepo.createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: bobId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    weeklyId = w.id;
    // Pre-crear una excepción para borrar después
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: MONDAY },
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("dueño borra su excepción → 204", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: MONDAY },
    });
    expect(res.statusCode).toBe(204);
  });

  it("admin borra excepción ajena → 204", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: aliceCookie },
      payload: { date: MONDAY },
    });
    expect(res.statusCode).toBe(204);
  });

  it("user ajeno no admin → 403", async () => {
    const charlieCookie = await loginAs(server, verifier, "charlie@teimas.com", "charlie-sub");
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: charlieCookie },
      payload: { date: MONDAY },
    });
    expect(res.statusCode).toBe(403);
  });

  it("excepción inexistente → 404 exception_not_found", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/weekly/${weeklyId}/exceptions`,
      headers: { cookie: bobCookie },
      payload: { date: "2026-05-11" }, // otro lunes sin excepción
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ reason: string }>().reason).toBe("exception_not_found");
  });
});
