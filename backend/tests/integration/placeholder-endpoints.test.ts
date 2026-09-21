import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { officeWithMap, deskAt, bookingFor } from "../support/fixtures.js";
import { todayIso } from "../../src/domain/bookings.js";
import { parseEnv } from "../../src/config/env.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

const PNG_BUF = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0),
]);

function makeTestEnv(avatarsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "",
    TEST_AUTH: "on",
    AVATARS_DIR: avatarsDir,
  });
}

function multipartBody(fieldName: string, filename: string, contentType: string, buf: Buffer) {
  const boundary = "----TestBoundary" + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf-8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
  return {
    body: Buffer.concat([head, buf, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/** Change 031: gestión y visibilidad de los placeholders vía HTTP. */
describe("endpoints de usuarios — placeholders (change 031)", () => {
  let testDb: TestDb;
  let server: TestServer;
  let placeholderId: number;
  let avatarsDir: string;

  /** Sesión vía el endpoint de test-auth, como el resto de la suite. */
  async function cookieFor(email: string, role: "admin" | "member"): Promise<string> {
    const res = await server.app.inject({
      method: "POST",
      url: "/api/test/session",
      body: { email, role },
    });
    const raw = Array.isArray(res.headers["set-cookie"])
      ? (res.headers["set-cookie"][0] ?? "")
      : String(res.headers["set-cookie"] ?? "");
    return raw.split(";")[0] ?? "";
  }

  beforeEach(async () => {
    testDb = setupTestDb();
    avatarsDir = mkdtempSync(join(tmpdir(), "vo-ph-avatars-"));
    server = await startTestServer({
      db: testDb.db,
      env: makeTestEnv(avatarsDir),
      googleVerifier: new FakeGoogleVerifier() as never,
    });
    const ph = testDb.db
      .prepare("SELECT id FROM users WHERE google_sub = 'placeholder:1'")
      .get() as { id: number };
    placeholderId = ph.id;
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(avatarsDir, { recursive: true, force: true });
  });

  it("GET /api/users por defecto no incluye placeholders", async () => {
    const c = await cookieFor("alice@teimas.com", "admin");
    await cookieFor("bob@teimas.com", "member");

    const res = await server.app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ is_placeholder: number }>;
    expect(body).toHaveLength(2); // admin + el member creado
    expect(body.every((u) => u.is_placeholder === 0)).toBe(true);
  });

  it("GET /api/users?includePlaceholders=1 los devuelve al final", async () => {
    const c = await cookieFor("alice@teimas.com", "admin");
    await cookieFor("bob@teimas.com", "member");

    const res = await server.app.inject({
      method: "GET",
      url: "/api/users?includePlaceholders=1",
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ is_placeholder: number; name: string }>;
    expect(body).toHaveLength(5); // 2 reales + 3 placeholders
    expect(body.slice(0, 2).every((u) => u.is_placeholder === 0)).toBe(true);
    expect(body.slice(2).map((u) => u.name)).toEqual([
      "Bloqueado #1",
      "Bloqueado #2",
      "Bloqueado #3",
    ]);
    expect(body.slice(2).every((u) => u.is_placeholder === 1)).toBe(true);
  });

  it("GET /api/users?email= de un placeholder lo devuelve", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/users?email=bloqueado1@teimas.space",
      headers: { cookie: await cookieFor("alice@teimas.com", "admin") },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ is_placeholder: number; name: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.is_placeholder).toBe(1);
    expect(body[0]!.name).toBe("Bloqueado #1");
  });

  it("GET /api/users?includePlaceholders=1 como member devuelve 403", async () => {
    const c = await cookieFor("bob@teimas.com", "member");

    const res = await server.app.inject({
      method: "GET",
      url: "/api/users?includePlaceholders=1",
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(403);
  });

  it("PATCH /api/users/:id sobre un placeholder devuelve 409 cannot_modify_placeholder", async () => {
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/users/${String(placeholderId)}`,
      headers: { cookie: await cookieFor("alice@teimas.com", "admin") },
      payload: { role: "admin" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ reason: "cannot_modify_placeholder" });

    const after = testDb.db.prepare("SELECT role FROM users WHERE id = ?").get(placeholderId) as {
      role: string;
    };
    expect(after.role).toBe("member");
  });

  it("PATCH /api/users/:id sobre un usuario real sigue funcionando (regresión)", async () => {
    const c = await cookieFor("alice@teimas.com", "admin");
    await cookieFor("bob@teimas.com", "member");
    const member = testDb.db
      .prepare("SELECT id FROM users WHERE email = 'bob@teimas.com'")
      .get() as { id: number };

    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/users/${String(member.id)}`,
      headers: { cookie: c },
      payload: { role: "admin" },
    });

    expect(res.statusCode).toBe(200);
    const after = testDb.db.prepare("SELECT role FROM users WHERE id = ?").get(member.id) as {
      role: string;
    };
    expect(after.role).toBe("admin");
  });

  it("POST /api/invitations con email de placeholder devuelve 422 cannot_invite_placeholder", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie: await cookieFor("alice@teimas.com", "admin") },
      payload: { email: "bloqueado1@teimas.space" },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ reason: "cannot_invite_placeholder" });

    const count = testDb.db.prepare("SELECT COUNT(*) AS n FROM invitations").get() as { n: number };
    expect(count.n).toBe(0);
  });

  it("POST /api/users/:id/avatar SÍ funciona sobre un placeholder", async () => {
    // El avatar custom es el mecanismo previsto para darle icono propio a un
    // "Bloqueado #N" en el mapa, así que aquí no hay restricción.
    const c = await cookieFor("alice@teimas.com", "admin");
    const m = multipartBody("file", "bloqueado.png", "image/png", PNG_BUF);

    const res = await server.app.inject({
      method: "POST",
      url: `/api/users/${String(placeholderId)}/avatar`,
      headers: { cookie: c, "content-type": m.contentType },
      payload: m.body,
    });

    expect(res.statusCode).toBe(200);
    const after = testDb.db
      .prepare("SELECT avatar_url, avatar_locked FROM users WHERE id = ?")
      .get(placeholderId) as { avatar_url: string; avatar_locked: number };
    expect(after.avatar_url).toMatch(/^\/avatars\/\d+_[0-9a-f]{8}\.png$/);
    expect(after.avatar_locked).toBe(1);
  });

  it("PATCH /api/users/:id sobre un id inexistente devuelve 404", async () => {
    const res = await server.app.inject({
      method: "PATCH",
      url: "/api/users/999999",
      headers: { cookie: await cookieFor("alice@teimas.com", "admin") },
      payload: { role: "admin" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ reason: "user_not_found" });
  });

  it("GET /api/users?date= marca has_daily_booking de un placeholder reservado en OTRA oficina", async () => {
    // El índice único de daily es (user_id, date) global: un placeholder usado
    // en la oficina 1 no puede bloquear nada en la oficina 2 ese mismo día.
    const c = await cookieFor("alice@teimas.com", "admin");
    const date = todayIso();
    const otraOficina = officeWithMap(testDb.db, { name: "Oficina Lejana" });
    const desk = deskAt(testDb.db, otraOficina.id, 100, 100, "Z9");
    bookingFor(testDb.db, placeholderId, desk.id, date, "daily");

    const res = await server.app.inject({
      method: "GET",
      url: `/api/users?includePlaceholders=1&date=${date}`,
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: number; name: string; has_daily_booking: number }>;
    const usado = body.find((u) => u.id === placeholderId)!;
    expect(usado.has_daily_booking).toBe(1);
    const libres = body.filter((u) => u.name.startsWith("Bloqueado") && u.id !== placeholderId);
    expect(libres).toHaveLength(2);
    expect(libres.every((u) => u.has_daily_booking === 0)).toBe(true);
  });

  it("GET /api/users?date= NO marca has_daily_booking por una reserva fixed", async () => {
    // La unicidad diaria es parcial (WHERE type='daily'): un placeholder con un
    // puesto fijo sigue pudiendo bloquear un puesto ese día.
    const c = await cookieFor("alice@teimas.com", "admin");
    const date = todayIso();
    const office = officeWithMap(testDb.db);
    const desk = deskAt(testDb.db, office.id, 50, 50, "F1");
    bookingFor(testDb.db, placeholderId, desk.id, date, "fixed");

    const res = await server.app.inject({
      method: "GET",
      url: `/api/users?includePlaceholders=1&date=${date}`,
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: number; has_daily_booking: number }>;
    expect(body.find((u) => u.id === placeholderId)!.has_daily_booking).toBe(0);
  });

  it("GET /api/users sin date no incluye has_daily_booking", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/users?includePlaceholders=1",
      headers: { cookie: await cookieFor("alice@teimas.com", "admin") },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<Record<string, unknown>>;
    expect(body.every((u) => !("has_daily_booking" in u))).toBe(true);
  });

  it("GET /api/users?date= con fecha malformada devuelve 400", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/users?includePlaceholders=1&date=2026-13-45",
      headers: { cookie: await cookieFor("alice@teimas.com", "admin") },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ reason: "bad_request" });
  });
});
