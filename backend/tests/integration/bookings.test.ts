import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { todayIso, addDaysIso } from "../../src/domain/bookings.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string, overrides: Record<string, string> = {}) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
    BOOKING_HORIZON_DAYS: "60",
    ...overrides,
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

function seedOfficeAndDesks(
  db: TestDb["db"],
  count: number = 3,
): { officeId: number; deskIds: number[] } {
  const oRes = db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", "map.tmj", 32, 32, 25, 19, 800, 608);
  const officeId = Number(oRes.lastInsertRowid);
  const deskIds: number[] = [];
  for (let i = 0; i < count; i++) {
    const d = db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, `D${i + 1}`, 100 + i * 60, 100, "manual");
    deskIds.push(Number(d.lastInsertRowid));
  }
  return { officeId, deskIds };
}

describe("POST /api/desks/:id/bookings", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let deskIds: number[];

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-bookings-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    ({ deskIds } = seedOfficeAndDesks(testDb.db, 3));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("autenticado en futuro próximo → 201", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ booking: { date: string; type: string; desk_id: number } }>();
    expect(body.booking.date).toBe(date);
    expect(body.booking.type).toBe("daily");
    expect(body.booking.desk_id).toBe(deskIds[0]);
  });

  it("date en el pasado → 422 date_in_past", async () => {
    const date = addDaysIso(todayIso(), -1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("date_in_past");
  });

  it("date más allá del horizonte → 422 date_out_of_horizon", async () => {
    const date = addDaysIso(todayIso(), 100);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("date_out_of_horizon");
  });

  it("otro user ya tiene la fecha → 409 desk_already_booked", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ reason: string }>().reason).toBe("desk_already_booked");
  });

  it("mismo user ya tiene otra reserva ese día → 409 user_already_booked_today", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[1]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ reason: string }>().reason).toBe("user_already_booked_today");
  });

  it("sin auth → 401", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      body: { date },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/desks/:id/bookings", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let deskIds: number[];

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-bookings-del-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    ({ deskIds } = seedOfficeAndDesks(testDb.db, 2));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("propio user libera su reserva → 204", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(204);
  });

  it("user member intenta liberar reserva ajena → 403", async () => {
    const charlieCookie = await loginAs(server, verifier, "charlie@teimas.com", "charlie-sub");
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: charlieCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin libera reserva ajena daily → 204", async () => {
    // Alice es admin (ADMIN_EMAILS la incluye en makeTestEnv)
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(204);
  });

  it("DELETE de booking inexistente → 404", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/offices/:id?date=...", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let officeId: number;
  let deskIds: number[];

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-bookings-get-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    ({ officeId, deskIds } = seedOfficeAndDesks(testDb.db, 2));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("incluye bookings del día consultado", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${date}`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; user: { name: string } }>;
    }>();
    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0]?.deskId).toBe(deskIds[0]);
    expect(body.bookings[0]?.user.name).toBe("alice");
  });

  it("sin ?date asume hoy en UTC", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date: todayIso() },
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ bookings: Array<unknown>; date: string }>();
    expect(body.date).toBe(todayIso());
    expect(body.bookings).toHaveLength(1);
  });

  it("cada booking incluye user con id, name y avatar_url", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${date}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      bookings: Array<{ user: { id: number; name: string; avatar_url: string | null } }>;
    }>();
    expect(body.bookings[0]?.user).toMatchObject({ name: "alice" });
    expect(body.bookings[0]?.user.id).toBeGreaterThan(0);
    expect("avatar_url" in body.bookings[0]!.user).toBe(true);
  });
});
