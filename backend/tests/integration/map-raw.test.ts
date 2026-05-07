import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string): ReturnType<typeof parseEnv> {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
  });
}

async function loginAdmin(server: TestServer, verifier: FakeGoogleVerifier): Promise<string> {
  verifier.setNextPayload({
    sub: "admin-sub",
    email: "alice@teimas.com",
    hd: "teimas.com",
    name: "Admin",
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

async function loginMember(server: TestServer, verifier: FakeGoogleVerifier): Promise<string> {
  verifier.setNextPayload({
    sub: "member-sub",
    email: "bob@teimas.com",
    hd: "teimas.com",
    name: "Member",
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

function insertOfficeWithTmj(
  testDb: TestDb,
  mapsDir: string,
  tmjBody: string,
): { officeId: number; expectedHash: string } {
  const stmt = testDb.db.prepare(
    `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
     VALUES (?, 'map.tmj', 32, 32, 10, 10, 320, 320)`,
  );
  const result = stmt.run("ofi");
  const officeId = Number(result.lastInsertRowid);
  const dir = join(mapsDir, String(officeId));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "map.tmj"), tmjBody);
  const expectedHash = createHash("sha256").update(tmjBody).digest("hex");
  return { officeId, expectedHash };
}

describe("GET /api/offices/:id/map/raw", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-map-raw-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("200: admin recibe { tmj, tmj_hash, tmj_filename } con hash correcto", async () => {
    const cookie = await loginAdmin(server, verifier);
    const tmjBody = '{"width":10,"height":10,"layers":[]}';
    const { officeId, expectedHash } = insertOfficeWithTmj(testDb, mapsDir, tmjBody);

    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}/map/raw`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ tmj: unknown; tmj_hash: string; tmj_filename: string }>();
    expect(body.tmj).toEqual({ width: 10, height: 10, layers: [] });
    expect(body.tmj_hash).toBe(expectedHash);
    expect(body.tmj_filename).toBe("map.tmj");
  });

  it("401 sin sesión", async () => {
    const { officeId } = insertOfficeWithTmj(testDb, mapsDir, "{}");
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}/map/raw`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("403 si usuario autenticado pero no admin", async () => {
    const cookie = await loginMember(server, verifier);
    const { officeId } = insertOfficeWithTmj(testDb, mapsDir, "{}");
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}/map/raw`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("404 si oficina no existe", async () => {
    const cookie = await loginAdmin(server, verifier);
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/9999/map/raw`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("404 si la oficina existe pero el fichero TMJ falta en disco", async () => {
    const cookie = await loginAdmin(server, verifier);
    const stmt = testDb.db.prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
       VALUES (?, 'map.tmj', 32, 32, 10, 10, 320, 320)`,
    );
    const r = stmt.run("ofi");
    const officeId = Number(r.lastInsertRowid);

    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}/map/raw`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
