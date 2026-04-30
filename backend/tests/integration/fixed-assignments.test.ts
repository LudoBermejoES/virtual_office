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

function seed(
  db: TestDb["db"],
): {
  officeId: number;
  deskIds: number[];
  bobId: number;
  charlieId: number;
} {
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
      .run(officeId, `D${i + 1}`, 100 + i * 80, 100, "manual");
    deskIds.push(Number(d.lastInsertRowid));
  }

  const bob = db
    .prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)")
    .run("bob-seed", "bob-seed@teimas.com", "teimas.com", "BobSeed", "member");
  const charlie = db
    .prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)")
    .run("charlie-seed", "charlie-seed@teimas.com", "teimas.com", "CharlieSeed", "member");

  return {
    officeId,
    deskIds,
    bobId: Number(bob.lastInsertRowid),
    charlieId: Number(charlie.lastInsertRowid),
  };
}

describe("POST/DELETE /api/desks/:id/fixed", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let memberCookie: string;
  let deskIds: number[];
  let bobId: number;
  let charlieId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-fixed-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    memberCookie = await loginAs(server, verifier, "dan@teimas.com", "dan-sub");
    ({ deskIds, bobId, charlieId } = seed(testDb.db));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("admin asigna fixed → 201", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ fixed: { desk_id: number; user_id: number } }>();
    expect(body.fixed).toMatchObject({ desk_id: deskIds[0], user_id: bobId });
  });

  it("desk ya tiene fixed → 409 desk_already_fixed", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: charlieId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ reason: string }>().reason).toBe("desk_already_fixed");
  });

  it("reasignar fixed de un usuario a otro desk → 201 y el anterior queda libre", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[1]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ fixed: { desk_id: number; user_id: number } }>();
    expect(body.fixed).toMatchObject({ desk_id: deskIds[1], user_id: bobId });

    // El desk anterior ya no tiene fijo
    const delOld = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
    });
    expect(delOld.statusCode).toBe(404);
  });

  it("userId inexistente → 404", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: 99999 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE admin → 204 cuando hay fixed", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(204);
  });

  it("DELETE cuando no hay fixed → 404", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Member intenta POST → 403", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: memberCookie },
      body: { userId: bobId },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Member intenta DELETE → 403", async () => {
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: memberCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/offices/:id?date=X con fixed", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let officeId: number;
  let deskIds: number[];
  let bobId: number;
  let charlieId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-fixed-get-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    ({ officeId, deskIds, bobId, charlieId } = seed(testDb.db));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("desk con fixed sin daily → bookings incluye {type:'fixed', user}", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });

    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${date}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; type: string; user: { name: string } }>;
    }>();
    const fixed = body.bookings.find((b) => b.type === "fixed");
    expect(fixed).toBeDefined();
    expect(fixed!.deskId).toBe(deskIds[0]);
    expect(fixed!.userId).toBe(bobId);
    expect(fixed!.user.name).toBe("BobSeed");
  });

  it("desk con fixed pero con daily preexistente → bookings refleja daily, no fixed", async () => {
    // Insertar daily directamente en DB para simular booking previa a la asignación de fixed
    const date = addDaysIso(todayIso(), 1);
    testDb.db
      .prepare("INSERT INTO bookings (desk_id, user_id, date, type) VALUES (?, ?, ?, ?)")
      .run(deskIds[0], charlieId, date, "daily");
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });

    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${date}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; type: string }>;
    }>();
    const onDesk = body.bookings.filter((b) => b.deskId === deskIds[0]);
    expect(onDesk).toHaveLength(1);
    expect(onDesk[0]!.type).toBe("daily");
    expect(onDesk[0]!.userId).toBe(charlieId);
  });

  it("sin date, los fixed aparecen en el día actual", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });

    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      date: string;
      bookings: Array<{ deskId: number; type: string }>;
    }>();
    expect(body.date).toBe(todayIso());
    expect(body.bookings.some((b) => b.deskId === deskIds[0] && b.type === "fixed")).toBe(true);
  });

  it("usuario con daily en otro puesto ese día → fixed no aparece en snapshot", async () => {
    const date = addDaysIso(todayIso(), 1);
    // Bob tiene fijo en deskIds[0]
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    // Bob elige manualmente deskIds[1] ese día
    testDb.db
      .prepare("INSERT INTO bookings (desk_id, user_id, date, type) VALUES (?, ?, ?, ?)")
      .run(deskIds[1], bobId, date, "daily");

    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${date}`,
      headers: { cookie: aliceCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; userId: number; type: string }>;
    }>();
    // Bob solo aparece en su reserva diaria, no en el fijo
    const bobBookings = body.bookings.filter((b) => b.userId === bobId);
    expect(bobBookings).toHaveLength(1);
    expect(bobBookings[0]!.deskId).toBe(deskIds[1]);
    expect(bobBookings[0]!.type).toBe("daily");
  });
});

describe("POST /api/desks/:id/bookings con desk fixed", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let memberCookie: string;
  let deskIds: number[];
  let bobId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-fixed-block-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    memberCookie = await loginAs(server, verifier, "dan@teimas.com", "dan-sub");
    ({ deskIds, bobId } = seed(testDb.db));
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("desk con fixed → POST /api/desks/:id/bookings rechaza con 409 desk_has_fixed_assignment", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: memberCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ reason: string }>().reason).toBe("desk_has_fixed_assignment");
  });
});
