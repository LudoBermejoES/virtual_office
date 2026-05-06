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

interface Seed {
  officeId: number;
  deskIds: number[];
  bobId: number;
  charlieId: number;
}

function seed(db: TestDb["db"]): Seed {
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

describe("POST/DELETE /api/desks/:id/fixed/skip", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let charlieCookie: string;
  let officeId: number;
  let deskIds: number[];
  let bobId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-fixed-exc-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    // bob y charlie usan los IDs del seed que coinciden con los del login si usamos el mismo email
    ({ officeId, deskIds, bobId } = seed(testDb.db));
    bobCookie = await loginAs(server, verifier, "bob-seed@teimas.com", "bob-seed");
    charlieCookie = await loginAs(server, verifier, "charlie-seed@teimas.com", "charlie-seed");

    // Asignar fijo a Bob en deskIds[0]
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("Titular del fijo crea excepción → 200", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ exception: { date: string } }>();
    expect(body.exception.date).toBe(date);
  });

  it("Admin crea excepción → 200", async () => {
    const date = addDaysIso(todayIso(), 2);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(200);
  });

  it("Member sin permisos → 403", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: charlieCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Fecha pasada → 400 date_in_past", async () => {
    const date = addDaysIso(todayIso(), -1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ reason: string }>().reason).toBe("date_in_past");
  });

  it("Fecha fuera del horizonte → 400 date_out_of_horizon", async () => {
    const date = addDaysIso(todayIso(), 365);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ reason: string }>().reason).toBe("date_out_of_horizon");
  });

  it("Desk sin fijo → 404 fixed_not_found", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[1]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ reason: string }>().reason).toBe("fixed_not_found");
  });

  it("Idempotente: segunda llamada devuelve mismo recurso", async () => {
    const date = addDaysIso(todayIso(), 1);
    const r1 = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const r2 = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r2.json<{ exception: { id: number } }>().exception.id).toBe(
      r1.json<{ exception: { id: number } }>().exception.id,
    );
  });

  it("DELETE titular borra excepción → 204", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(204);
  });

  it("DELETE admin borra excepción de otro → 204", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(204);
  });

  it("DELETE member → 403", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: charlieCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE excepción inexistente → 404 not_found", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Snapshot omite fijo en día con excepción", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${date}`,
      headers: { cookie: bobCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; type: string }>;
      myFixedExceptionDeskId: number | null;
    }>();
    expect(body.bookings.find((b) => b.deskId === deskIds[0])).toBeUndefined();
    expect(body.myFixedExceptionDeskId).toBe(deskIds[0]);
  });

  it("Snapshot incluye fijo en día sin excepción", async () => {
    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${date}`,
      headers: { cookie: bobCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; type: string; userId: number }>;
      myFixedExceptionDeskId: number | null;
    }>();
    const fixed = body.bookings.find((b) => b.deskId === deskIds[0]);
    expect(fixed).toBeDefined();
    expect(fixed!.type).toBe("fixed");
    expect(body.myFixedExceptionDeskId).toBeNull();
  });

  it("Excepción para X no afecta al snapshot de X+1", async () => {
    const date = addDaysIso(todayIso(), 1);
    const dateNext = addDaysIso(todayIso(), 2);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed/skip`,
      headers: { cookie: bobCookie },
      body: { date },
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}?date=${dateNext}`,
      headers: { cookie: bobCookie },
    });
    const body = res.json<{
      bookings: Array<{ deskId: number; type: string }>;
    }>();
    expect(body.bookings.find((b) => b.deskId === deskIds[0] && b.type === "fixed")).toBeDefined();
  });
});
