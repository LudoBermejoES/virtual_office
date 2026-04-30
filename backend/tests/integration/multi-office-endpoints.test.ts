import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { makeTmj, makePng } from "../support/tiled-fixtures.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "superadmin@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
  });
}

function buildMultipart(
  fields: Array<
    | { name: string; value: string }
    | { name: string; filename: string; contentType: string; data: Buffer }
  >,
): { body: Buffer; headers: Record<string, string> } {
  const boundary = `----vitest${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];
  for (const f of fields) {
    if ("value" in f) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`,
        ),
      );
    } else {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`,
        ),
      );
      parts.push(f.data);
      parts.push(Buffer.from("\r\n"));
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(parts),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

async function loginUser(
  server: TestServer,
  verifier: FakeGoogleVerifier,
  sub: string,
  email: string,
): Promise<string> {
  verifier.setNextPayload({
    sub,
    email,
    hd: "teimas.com",
    name: email,
    iss: "accounts.google.com",
    email_verified: true,
  } as never);
  const res = await server.app.inject({
    method: "POST",
    url: "/api/auth/google",
    body: { idToken: "fake" },
  });
  const raw = Array.isArray(res.headers["set-cookie"])
    ? (res.headers["set-cookie"][0] ?? "")
    : String(res.headers["set-cookie"] ?? "");
  return raw.split(";")[0] ?? "";
}

async function createOffice(server: TestServer, cookie: string): Promise<number> {
  const mp = buildMultipart([
    { name: "name", value: "Test Office" },
    {
      name: "tmj",
      filename: "map.tmj",
      contentType: "application/json",
      data: Buffer.from(makeTmj()),
    },
    { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
  ]);
  const res = await server.app.inject({
    method: "POST",
    url: "/api/offices",
    headers: { ...mp.headers, cookie },
    body: mp.body,
  });
  return (res.json() as { office: { id: number } }).office.id;
}

describe("GET /api/offices — flags is_admin e is_default", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let superCookie: string;
  let memberCookie: string;
  let officeId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-me-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    superCookie = await loginUser(server, verifier, "sa-sub", "superadmin@teimas.com");
    memberCookie = await loginUser(server, verifier, "mb-sub", "member@teimas.com");
    officeId = await createOffice(server, superCookie);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // 3.1 — GET /api/offices incluye is_admin e is_default
  it("super-admin ve is_admin=true e is_default=false por defecto", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/offices",
      headers: { cookie: superCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ id: number; is_admin: boolean; is_default: boolean }>;
    const entry = list.find((o) => o.id === officeId);
    expect(entry).toBeDefined();
    expect(entry!.is_admin).toBe(true);
    expect(entry!.is_default).toBe(false);
  });

  it("office-admin ve is_admin=true para su oficina", async () => {
    const memberId = (
      testDb.db
        .prepare("SELECT id FROM users WHERE email='member@teimas.com'")
        .get() as { id: number }
    ).id;
    testDb.db
      .prepare("INSERT INTO office_admins (office_id, user_id) VALUES (?, ?)")
      .run(officeId, memberId);

    const res = await server.app.inject({
      method: "GET",
      url: "/api/offices",
      headers: { cookie: memberCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ id: number; is_admin: boolean; is_default: boolean }>;
    const entry = list.find((o) => o.id === officeId);
    expect(entry!.is_admin).toBe(true);
    expect(entry!.is_default).toBe(false);
  });

  it("member normal ve is_admin=false", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/offices",
      headers: { cookie: memberCookie },
    });
    const list = res.json() as Array<{ id: number; is_admin: boolean }>;
    const entry = list.find((o) => o.id === officeId);
    expect(entry!.is_admin).toBe(false);
  });
});

describe("PATCH /api/me — default_office_id", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let memberCookie: string;
  let officeId: number;
  let superCookie: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-me2-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    superCookie = await loginUser(server, verifier, "sa2-sub", "superadmin@teimas.com");
    memberCookie = await loginUser(server, verifier, "mb2-sub", "member2@teimas.com");
    officeId = await createOffice(server, superCookie);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // 3.2 — PATCH /api/me persiste default_office_id
  it("persiste default_office_id y se refleja en GET /api/me", async () => {
    const patchRes = await server.app.inject({
      method: "PATCH",
      url: "/api/me",
      headers: { cookie: memberCookie, "content-type": "application/json" },
      body: JSON.stringify({ default_office_id: officeId }),
    });
    expect(patchRes.statusCode).toBe(204);

    const meRes = await server.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { cookie: memberCookie },
    });
    expect(meRes.statusCode).toBe(200);
    const me = meRes.json() as { default_office_id: number };
    expect(me.default_office_id).toBe(officeId);
  });

  it("default_office_id aparece en GET /api/offices como is_default=true", async () => {
    await server.app.inject({
      method: "PATCH",
      url: "/api/me",
      headers: { cookie: memberCookie, "content-type": "application/json" },
      body: JSON.stringify({ default_office_id: officeId }),
    });

    const res = await server.app.inject({
      method: "GET",
      url: "/api/offices",
      headers: { cookie: memberCookie },
    });
    const list = res.json() as Array<{ id: number; is_default: boolean }>;
    const entry = list.find((o) => o.id === officeId);
    expect(entry!.is_default).toBe(true);
  });
});

describe("POST/DELETE /api/offices/:id/admins — gestión de office-admins", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let superCookie: string;
  let officeAdminCookie: string;
  let memberCookie: string;
  let officeId: number;
  let memberId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-oa2-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    superCookie = await loginUser(server, verifier, "sa3-sub", "superadmin@teimas.com");
    officeAdminCookie = await loginUser(server, verifier, "oa-sub", "officeadmin@teimas.com");
    memberCookie = await loginUser(server, verifier, "mb3-sub", "member3@teimas.com");
    officeId = await createOffice(server, superCookie);
    memberId = (
      testDb.db
        .prepare("SELECT id FROM users WHERE email='member3@teimas.com'")
        .get() as { id: number }
    ).id;

    // officeadmin es office-admin de la oficina
    const oaId = (
      testDb.db
        .prepare("SELECT id FROM users WHERE email='officeadmin@teimas.com'")
        .get() as { id: number }
    ).id;
    testDb.db
      .prepare("INSERT INTO office_admins (office_id, user_id) VALUES (?, ?)")
      .run(officeId, oaId);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // 3.3 — POST /api/offices/:id/admins
  it("super-admin puede crear office-admin: 201", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/admins`,
      headers: { cookie: superCookie, "content-type": "application/json" },
      body: JSON.stringify({ user_id: memberId }),
    });
    expect(res.statusCode).toBe(201);

    const row = testDb.db
      .prepare("SELECT * FROM office_admins WHERE office_id=? AND user_id=?")
      .get(officeId, memberId);
    expect(row).toBeDefined();
  });

  it("office-admin no puede crear office-admin: 403", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/admins`,
      headers: { cookie: officeAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({ user_id: memberId }),
    });
    expect(res.statusCode).toBe(403);
  });

  // 3.4 — DELETE /api/offices/:id/admins/:userId
  it("super-admin puede eliminar office-admin: 204", async () => {
    const oaId = (
      testDb.db
        .prepare("SELECT id FROM users WHERE email='officeadmin@teimas.com'")
        .get() as { id: number }
    ).id;

    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/offices/${officeId}/admins/${oaId}`,
      headers: { cookie: superCookie },
    });
    expect(res.statusCode).toBe(204);

    const row = testDb.db
      .prepare("SELECT * FROM office_admins WHERE office_id=? AND user_id=?")
      .get(officeId, oaId);
    expect(row).toBeUndefined();
  });

  it("office-admin no puede eliminar office-admin: 403", async () => {
    const oaId = (
      testDb.db
        .prepare("SELECT id FROM users WHERE email='officeadmin@teimas.com'")
        .get() as { id: number }
    ).id;

    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/offices/${officeId}/admins/${oaId}`,
      headers: { cookie: officeAdminCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
