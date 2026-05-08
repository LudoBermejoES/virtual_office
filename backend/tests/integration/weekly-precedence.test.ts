/**
 * Tests de integración del cómputo de bookings por fecha cuando hay
 * weekly_assignments (change 027). Reglas: daily > fixed > weekly,
 * weekly_exceptions invalidan el slot.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { createWeekly, createException } from "../../src/infra/repos/weekly-assignments.js";
import * as bookingsRepo from "../../src/infra/repos/bookings.js";
import * as fixedRepo from "../../src/infra/repos/fixed-assignments.js";
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

function seed(testDb: TestDb): {
  officeId: number;
  deskIds: number[];
  aliceId: number;
  bobId: number;
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
  return {
    officeId,
    deskIds,
    aliceId: getUserIdByEmail(testDb, "alice@teimas.com"),
    bobId: getUserIdByEmail(testDb, "bob@teimas.com"),
  };
}

function getUserIdByEmail(testDb: TestDb, email: string): number {
  const row = testDb.db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`user ${email} not found`);
  return row.id;
}

const MONDAY = "2026-05-04"; // dow=0 (lunes ISO)
const TUESDAY = "2026-05-05"; // dow=1

describe("GET /api/offices/:id?date=... — weekly precedencia", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-weekly-prec-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    await loginAs(server, verifier, "bob@teimas.com", "bob-sub"); // crea Bob
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("weekly aparece en el booking del lunes correspondiente", async () => {
    const { officeId, deskIds, aliceId } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      dow: 0,
      created_by_user_id: aliceId,
    });

    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${MONDAY}`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; type: string }>;
    }>();
    const wb = body.bookings.find((b) => b.deskId === deskIds[0]);
    expect(wb).toBeDefined();
    expect(wb!.type).toBe("weekly");
    expect(wb!.userId).toBe(aliceId);
  });

  it("en martes (dow distinto) NO aparece la weekly del lunes", async () => {
    const { officeId, deskIds, aliceId } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${TUESDAY}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{ bookings: Array<{ deskId: number }> }>();
    expect(body.bookings.find((b) => b.deskId === deskIds[0])).toBeUndefined();
  });

  it("weekly_exception suprime el slot", async () => {
    const { officeId, deskIds, aliceId } = seed(testDb);
    const w = createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    createException(testDb.db, w.id, MONDAY);
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${MONDAY}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{ bookings: Array<{ deskId: number }> }>();
    expect(body.bookings.find((b) => b.deskId === deskIds[0])).toBeUndefined();
  });

  it("daily prevalece sobre weekly en mismo (desk, date)", async () => {
    const { officeId, deskIds, aliceId, bobId } = seed(testDb);
    // Ana tiene weekly los lunes en desk0
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    // Bob reserva daily lunes en desk0
    bookingsRepo.createBooking(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: bobId,
      date: MONDAY,
      type: "daily",
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${MONDAY}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; type: string }>;
    }>();
    const at0 = body.bookings.find((b) => b.deskId === deskIds[0])!;
    expect(at0.type).toBe("daily");
    expect(at0.userId).toBe(bobId);
    // Ana NO aparece (su weekly fue suprimida implícitamente: daily gana y user_taken)
    expect(body.bookings.find((b) => b.userId === aliceId)).toBeUndefined();
  });

  it("daily de otro desk no impide la weekly en su desk si los users son distintos", async () => {
    const { officeId, deskIds, aliceId, bobId } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    bookingsRepo.createBooking(testDb.db, {
      desk_id: deskIds[1]!,
      user_id: bobId,
      date: MONDAY,
      type: "daily",
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${MONDAY}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; type: string }>;
    }>();
    expect(body.bookings.find((b) => b.deskId === deskIds[0])?.type).toBe("weekly");
    expect(body.bookings.find((b) => b.deskId === deskIds[1])?.type).toBe("daily");
  });

  it("dos weeklies distintos en distintos desks aparecen ambos", async () => {
    const { officeId, deskIds, aliceId, bobId } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    createWeekly(testDb.db, {
      desk_id: deskIds[1]!,
      user_id: bobId,
      dow: 0,
      created_by_user_id: aliceId,
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${MONDAY}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{ bookings: Array<{ deskId: number; type: string }> }>();
    expect(body.bookings.filter((b) => b.type === "weekly")).toHaveLength(2);
  });

  it("fixed y weekly no pueden coexistir en el mismo desk: si por consistencia hubiera fixed, weekly no se proyecta", async () => {
    const { officeId, deskIds, aliceId, bobId } = seed(testDb);
    fixedRepo.createFixedAssignment(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: aliceId,
      assigned_by_user_id: aliceId,
    });
    // Sin pasar por endpoint (que rechazaría 409): forzamos weekly directamente.
    // Esto es defensivo: si por algún motivo la consistencia se rompe, el cómputo
    // sigue siendo correcto (gana fixed).
    testDb.db
      .prepare(
        "INSERT INTO weekly_assignments (desk_id, user_id, dow, created_by_user_id) VALUES (?, ?, ?, ?)",
      )
      .run(deskIds[0]!, bobId, 0, aliceId);
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${MONDAY}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; type: string }>;
    }>();
    const at0 = body.bookings.find((b) => b.deskId === deskIds[0])!;
    expect(at0.type).toBe("fixed");
    expect(at0.userId).toBe(aliceId);
  });
});
