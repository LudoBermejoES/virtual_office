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
  const body = Buffer.concat(parts);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

function makeTestEnv(mapsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "superadmin@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
  });
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

describe("office-admin — permisos por oficina", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let superAdminCookie: string;
  let memberCookie: string;
  let officeId1: number;
  let officeId2: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-oa-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });

    // login super-admin y member
    superAdminCookie = await loginUser(server, verifier, "sa-sub", "superadmin@teimas.com");
    memberCookie = await loginUser(server, verifier, "mb-sub", "member@teimas.com");

    // crear dos oficinas como super-admin
    const mp = buildMultipart([
      { name: "name", value: "Oficina1" },
      { name: "tmj", filename: "map.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const r1 = await server.app.inject({
      method: "POST", url: "/api/offices",
      headers: { ...mp.headers, cookie: superAdminCookie },
      body: mp.body,
    });
    officeId1 = (r1.json() as { office: { id: number } }).office.id;

    const mp2 = buildMultipart([
      { name: "name", value: "Oficina2" },
      { name: "tmj", filename: "map.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const r2 = await server.app.inject({
      method: "POST", url: "/api/offices",
      headers: { ...mp2.headers, cookie: superAdminCookie },
      body: mp2.body,
    });
    officeId2 = (r2.json() as { office: { id: number } }).office.id;

    // asignar member como office-admin de oficina1
    const memberId = (
      testDb.db.prepare("SELECT id FROM users WHERE email='member@teimas.com'").get() as { id: number }
    ).id;
    testDb.db
      .prepare("INSERT INTO office_admins (office_id, user_id) VALUES (?, ?)")
      .run(officeId1, memberId);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // 2.4 — office-admin puede subir mapa a su oficina, 403 en la otra
  it("office-admin puede hacer PATCH en su oficina", async () => {
    const mp = buildMultipart([
      { name: "tmj", filename: "map.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const res = await server.app.inject({
      method: "PATCH", url: `/api/offices/${officeId1}`,
      headers: { ...mp.headers, cookie: memberCookie },
      body: mp.body,
    });
    expect(res.statusCode).toBe(200);
  });

  it("office-admin recibe 403 al intentar PATCH en otra oficina", async () => {
    const mp = buildMultipart([
      { name: "tmj", filename: "map.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const res = await server.app.inject({
      method: "PATCH", url: `/api/offices/${officeId2}`,
      headers: { ...mp.headers, cookie: memberCookie },
      body: mp.body,
    });
    expect(res.statusCode).toBe(403);
  });
});
