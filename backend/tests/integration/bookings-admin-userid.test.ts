/**
 * Tests del change 026: POST/DELETE bookings aceptan `userId?` opcional con
 * guarda admin-only.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { todayIso } from "../../src/domain/bookings.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
    BOOKING_HORIZON_DAYS: "60",
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

function seedOfficeAndDesks(db: TestDb["db"]): { officeId: number; deskIds: number[] } {
  const oRes = db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", "map.tmj", 32, 32, 25, 19, 800, 608);
  const officeId = Number(oRes.lastInsertRowid);
  const deskIds: number[] = [];
  for (let i = 0; i < 3; i++) {
    const d = db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, `D${i + 1}`, 100 + i * 60, 100, "manual");
    deskIds.push(Number(d.lastInsertRowid));
  }
  return { officeId, deskIds };
}

function getUserIdByEmail(db: TestDb["db"], email: string): number {
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`user ${email} not found`);
  return row.id;
}

describe("POST /api/desks/:id/bookings — userId admin", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let deskIds: number[];
  let aliceId: number;
  let bobId: number;
  const today = todayIso();

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-bookings-userid-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    aliceId = getUserIdByEmail(testDb.db, "alice@teimas.com");
    bobId = getUserIdByEmail(testDb.db, "bob@teimas.com");
    ({ deskIds } = seedOfficeAndDesks(testDb.db));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("admin con userId reserva para ese usuario; respuesta 201 con user_id correcto", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      payload: { date: today, userId: bobId },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ booking: { user_id: number; date: string; type: string } }>();
    expect(body.booking.user_id).toBe(bobId);
    expect(body.booking.type).toBe("daily");
  });

  it("no-admin con userId → 403 forbidden", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: bobCookie },
      payload: { date: today, userId: aliceId },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ reason: string }>().reason).toBe("forbidden");
  });

  it("admin con userId que no existe → 404 user_not_found", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      payload: { date: today, userId: 99999 },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ reason: string }>().reason).toBe("user_not_found");
  });

  it("admin con userId === me se comporta como sin userId (idempotente)", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      payload: { date: today, userId: aliceId },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ booking: { user_id: number } }>().booking.user_id).toBe(aliceId);
  });

  it("validaciones existentes aplican al userId destino: doble reserva del destino → 409", async () => {
    // Bob ya reserva D1
    const r1 = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: bobCookie },
      payload: { date: today },
    });
    expect(r1.statusCode).toBe(201);

    // Alice (admin) intenta reservar D2 a Bob el mismo día → 409
    const r2 = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[1]}/bookings`,
      headers: { cookie: aliceCookie },
      payload: { date: today, userId: bobId },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json<{ reason: string }>().reason).toBe("user_already_booked_today");
  });

  it("respuesta del booking incluye user_id del destino, no del admin caller", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      payload: { date: today, userId: bobId },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ booking: { user_id: number } }>().booking.user_id).toBe(bobId);
  });
});

describe("DELETE /api/desks/:id/bookings — userId admin", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let deskIds: number[];
  let bobId: number;
  const today = todayIso();

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-bookings-userid-del-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    bobCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    bobId = getUserIdByEmail(testDb.db, "bob@teimas.com");
    ({ deskIds } = seedOfficeAndDesks(testDb.db));

    // Bob reserva D1
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: bobCookie },
      payload: { date: today },
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("admin con userId libera la reserva de ese usuario → 204", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      payload: { date: today, userId: bobId },
    });
    expect(res.statusCode).toBe(204);
  });

  it("no-admin con userId → 403", async () => {
    const charlieCookie = await loginAs(server, verifier, "charlie@teimas.com", "charlie-sub");
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: charlieCookie },
      payload: { date: today, userId: bobId },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin con userId pero booking de otro usuario en ese desk: el actual servicio borra por (desk,date) sin importar userId — el campo es para auditoría", async () => {
    // En el modelo actual hay un único booking por (desk, date), así que userId
    // sirve para validar/auditar pero el delete no lo necesita para localizar.
    // Validamos que no rompe.
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      payload: { date: today, userId: bobId },
    });
    expect(res.statusCode).toBe(204);
  });
});
