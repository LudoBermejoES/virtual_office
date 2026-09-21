/**
 * Change 031: bloquear puestos a nombre de un placeholder "Bloqueado #N".
 *
 * El valor de este change es que NO añade endpoints ni tipos de booking:
 * bloquear un puesto es reservarlo con `userId` de placeholder por los
 * endpoints que ya existen (026 daily, 008 fixed, 027 weekly, 028 excepciones).
 * Estos tests verifican justamente eso, incluido el límite de tres bloqueos
 * simultáneos por día que se deriva de no tocar los índices de unicidad.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { todayIso, addDaysIso } from "../../src/domain/bookings.js";
import { dowOfDate } from "@virtual-office/shared";
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

function seedOfficeAndDesks(db: TestDb["db"], n = 4): { officeId: number; deskIds: number[] } {
  const oRes = db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", "map.tmj", 32, 32, 25, 19, 800, 608);
  const officeId = Number(oRes.lastInsertRowid);
  const deskIds: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, `D${i + 1}`, 100 + i * 60, 100, "manual");
    deskIds.push(Number(d.lastInsertRowid));
  }
  return { officeId, deskIds };
}

describe("bloqueo de puestos con placeholders (change 031)", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let adminCookie: string;
  let memberCookie: string;
  let officeId: number;
  let deskIds: number[];
  let ph: number[];
  let aliceId: number;

  /** Mañana, para no depender de la hora del día al correr los tests. */
  const date = addDaysIso(todayIso(), 1);

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-ph-block-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    adminCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    memberCookie = await loginAs(server, verifier, "bob@teimas.com", "bob-sub");
    aliceId = (
      testDb.db.prepare("SELECT id FROM users WHERE email = 'alice@teimas.com'").get() as {
        id: number;
      }
    ).id;
    ({ officeId, deskIds } = seedOfficeAndDesks(testDb.db));
    ph = (
      testDb.db
        .prepare("SELECT id FROM users WHERE is_placeholder = 1 ORDER BY google_sub")
        .all() as Array<{ id: number }>
    ).map((r) => r.id);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  const block = (deskId: number, userId: number, d: string = date) =>
    server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskId)}/bookings`,
      headers: { cookie: adminCookie },
      payload: { date: d, userId },
    });

  it("admin bloquea un puesto para un día concreto → 201 type daily", async () => {
    const res = await block(deskIds[0]!, ph[0]!);

    expect(res.statusCode).toBe(201);
    const body = res.json() as { booking: { user_id: number; date: string; type: string } };
    expect(body.booking.user_id).toBe(ph[0]);
    expect(body.booking.date).toBe(date);
    expect(body.booking.type).toBe("daily");
  });

  it("admin desbloquea el puesto → 204 y la reserva desaparece", async () => {
    await block(deskIds[0]!, ph[0]!);

    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${String(deskIds[0]!)}/bookings`,
      headers: { cookie: adminCookie },
      payload: { date, userId: ph[0] },
    });

    expect(res.statusCode).toBe(204);
    const row = testDb.db
      .prepare("SELECT * FROM bookings WHERE desk_id = ? AND date = ?")
      .get(deskIds[0]!, date);
    expect(row).toBeUndefined();
  });

  it("tres puestos bloqueados el mismo día, uno por placeholder", async () => {
    const r1 = await block(deskIds[0]!, ph[0]!);
    const r2 = await block(deskIds[1]!, ph[1]!);
    const r3 = await block(deskIds[2]!, ph[2]!);
    expect([r1.statusCode, r2.statusCode, r3.statusCode]).toEqual([201, 201, 201]);

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/offices/${String(officeId)}?date=${date}`,
      headers: { cookie: adminCookie },
    });
    const bookings = (detail.json() as { bookings: Array<{ deskId: number; userId: number }> })
      .bookings;
    expect(bookings).toHaveLength(3);
    expect(bookings.map((b) => b.userId).sort()).toEqual([...ph].sort());
  });

  it("un cuarto bloqueo reutilizando un placeholder agotado → 409 user_already_booked_today", async () => {
    await block(deskIds[0]!, ph[0]!);
    await block(deskIds[1]!, ph[1]!);
    await block(deskIds[2]!, ph[2]!);

    const res = await block(deskIds[3]!, ph[0]!);

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ reason: "user_already_booked_today" });
    const count = testDb.db
      .prepare("SELECT COUNT(*) AS n FROM bookings WHERE date = ?")
      .get(date) as { n: number };
    expect(count.n).toBe(3);
  });

  it("un placeholder sí puede estar en puestos distintos en días distintos", async () => {
    const r1 = await block(deskIds[0]!, ph[0]!, date);
    const r2 = await block(deskIds[1]!, ph[0]!, addDaysIso(date, 1));

    expect([r1.statusCode, r2.statusCode]).toEqual([201, 201]);
    const count = testDb.db
      .prepare("SELECT COUNT(*) AS n FROM bookings WHERE user_id = ?")
      .get(ph[0]!) as { n: number };
    expect(count.n).toBe(2);
  });

  it("bloqueo indefinido mediante fixed → aparece con type fixed en cualquier fecha", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/fixed`,
      headers: { cookie: adminCookie },
      payload: { userId: ph[1] },
    });
    expect(res.statusCode).toBe(201);

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/offices/${String(officeId)}?date=${addDaysIso(date, 10)}`,
      headers: { cookie: adminCookie },
    });
    const bookings = (
      detail.json() as { bookings: Array<{ deskId: number; userId: number; type: string }> }
    ).bookings;
    const b = bookings.find((x) => x.deskId === deskIds[0]);
    expect(b).toBeDefined();
    expect(b!.userId).toBe(ph[1]);
    expect(b!.type).toBe("fixed");
  });

  it("bloqueo semanal recurrente → aparece con type weekly ese dow", async () => {
    const dow = dowOfDate(date);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/weekly`,
      headers: { cookie: adminCookie },
      payload: { userId: ph[2], dow },
    });
    expect(res.statusCode).toBe(201);

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/offices/${String(officeId)}?date=${date}`,
      headers: { cookie: adminCookie },
    });
    const bookings = (
      detail.json() as { bookings: Array<{ deskId: number; userId: number; type: string }> }
    ).bookings;
    const b = bookings.find((x) => x.deskId === deskIds[0]);
    expect(b).toBeDefined();
    expect(b!.userId).toBe(ph[2]);
    expect(b!.type).toBe("weekly");
  });

  it("un placeholder no puede tener dos weeklies el mismo dow → 409 user_dow_conflict", async () => {
    const dow = dowOfDate(date);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/weekly`,
      headers: { cookie: adminCookie },
      payload: { userId: ph[0], dow },
    });

    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[1]!)}/weekly`,
      headers: { cookie: adminCookie },
      payload: { userId: ph[0], dow },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ reason: "user_dow_conflict" });
  });

  it("excepción de un día sobre un bloqueo semanal libera el puesto", async () => {
    const dow = dowOfDate(date);
    const created = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/weekly`,
      headers: { cookie: adminCookie },
      payload: { userId: ph[0], dow },
    });
    const weeklyId = (created.json() as { weekly: { id: number } }).weekly.id;

    const exc = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/weekly/${String(weeklyId)}/exceptions`,
      headers: { cookie: adminCookie },
      payload: { date },
    });
    expect(exc.statusCode).toBe(201);

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/offices/${String(officeId)}?date=${date}`,
      headers: { cookie: adminCookie },
    });
    const bookings = (detail.json() as { bookings: Array<{ deskId: number }> }).bookings;
    expect(bookings.find((x) => x.deskId === deskIds[0])).toBeUndefined();
  });

  it("member no puede bloquear puestos → 403 forbidden", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/bookings`,
      headers: { cookie: memberCookie },
      payload: { date, userId: ph[0] },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ reason: "forbidden" });
    const count = testDb.db.prepare("SELECT COUNT(*) AS n FROM bookings").get() as { n: number };
    expect(count.n).toBe(0);
  });

  it("las validaciones de ventana aplican igual al placeholder → 422 date_in_past", async () => {
    const res = await block(deskIds[0]!, ph[0]!, addDaysIso(todayIso(), -3));

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ reason: "date_in_past" });
  });

  it("un usuario real no puede reservar un puesto bloqueado → 409 desk_already_booked", async () => {
    await block(deskIds[0]!, ph[0]!);

    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/bookings`,
      headers: { cookie: memberCookie },
      payload: { date },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ reason: "desk_already_booked" });
  });

  it("el detalle proyecta el bloqueo como daily con el nombre del placeholder y sin campos extra", async () => {
    await block(deskIds[0]!, ph[0]!);

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/offices/${String(officeId)}?date=${date}`,
      headers: { cookie: adminCookie },
    });
    const bookings = (
      detail.json() as {
        bookings: Array<{
          deskId: number;
          type: string;
          user: { name: string };
        }>;
      }
    ).bookings;
    const b = bookings.find((x) => x.deskId === deskIds[0])!;
    expect(b.type).toBe("daily");
    expect(b.user.name).toBe("Bloqueado #1");
    // Sin campo extra de bloqueo: el cliente lo distingue por el nombre.
    expect(Object.keys(b).sort()).toEqual(["date", "deskId", "id", "type", "user", "userId"]);
  });

  it("daily de un usuario real prevalece sobre el weekly de un placeholder", async () => {
    const dow = dowOfDate(date);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/weekly`,
      headers: { cookie: adminCookie },
      payload: { userId: ph[0], dow },
    });
    // El admin reserva ese mismo desk/fecha para sí mismo (usuario real).
    const daily = await server.app.inject({
      method: "POST",
      url: `/api/desks/${String(deskIds[0]!)}/bookings`,
      headers: { cookie: adminCookie },
      payload: { date },
    });
    expect(daily.statusCode).toBe(201);

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/offices/${String(officeId)}?date=${date}`,
      headers: { cookie: adminCookie },
    });
    const bookings = (
      detail.json() as { bookings: Array<{ deskId: number; userId: number; type: string }> }
    ).bookings;
    const b = bookings.find((x) => x.deskId === deskIds[0])!;
    expect(b.userId).toBe(aliceId);
    expect(b.type).toBe("daily");
    expect(bookings.some((x) => x.userId === ph[0])).toBe(false);
  });
});
