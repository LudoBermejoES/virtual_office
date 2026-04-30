import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { parseEnv } from "../../src/config/env.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(overrides: Record<string, string> = {}) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    ...overrides,
  });
}

describe("POST /api/test/session (TEST_AUTH=on)", () => {
  let testDb: TestDb;
  let server: TestServer;

  beforeEach(async () => {
    testDb = setupTestDb();
    server = await startTestServer({
      db: testDb.db,
      env: makeTestEnv({ TEST_AUTH: "on", NODE_ENV: "test" }),
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("crea usuario nuevo y devuelve cookie firmada válida", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: "/api/test/session",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com", role: "admin" }),
    });

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/^session=/);
    expect(cookieStr).toContain("HttpOnly");
    expect(cookieStr).toContain("SameSite=Lax");

    const body = res.json<{ id: number; email: string; role: string }>();
    expect(body.email).toBe("alice@example.com");
    expect(body.role).toBe("admin");
    expect(body.id).toBeTypeOf("number");
  });

  it("idempotente: segunda llamada con mismo email devuelve mismo usuario", async () => {
    await server.app.inject({
      method: "POST",
      url: "/api/test/session",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "bob@example.com", role: "member" }),
    });

    const res2 = await server.app.inject({
      method: "POST",
      url: "/api/test/session",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "bob@example.com", role: "member" }),
    });

    expect(res2.statusCode).toBe(200);
    const body = res2.json<{ email: string }>();
    expect(body.email).toBe("bob@example.com");
  });
});

describe("POST /api/test/session con NODE_ENV=production y TEST_AUTH=on", () => {
  it("buildServer lanza error fatal", async () => {
    const testDb = setupTestDb();
    await expect(
      startTestServer({
        db: testDb.db,
        env: makeTestEnv({ TEST_AUTH: "on", NODE_ENV: "production" }),
      }),
    ).rejects.toThrow("FATAL");
    testDb.cleanup();
  });
});

describe("POST /api/test/session con TEST_AUTH=off", () => {
  let testDb: TestDb;
  let server: TestServer;

  beforeEach(async () => {
    testDb = setupTestDb();
    server = await startTestServer({
      db: testDb.db,
      env: makeTestEnv({ TEST_AUTH: "off" }),
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("devuelve 404", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: "/api/test/session",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "eve@example.com", role: "member" }),
    });
    expect(res.statusCode).toBe(404);
  });
});
