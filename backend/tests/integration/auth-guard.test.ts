import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(overrides: Record<string, string> = {}) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "",
    ...overrides,
  });
}

describe("requireAdmin — autorización por rol", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(),
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  async function loginAs(email: string, isAdmin: boolean): Promise<string> {
    const adminEnv = makeTestEnv({ ADMIN_EMAILS: isAdmin ? email : "" });
    await server.teardown();
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: adminEnv,
    });

    verifier.setNextPayload({
      sub: `sub-${email}`,
      email,
      hd: "teimas.com",
      name: "Test User",
      iss: "accounts.google.com",
      email_verified: true,
    });
    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });
    const cookieHeader = res.headers["set-cookie"];
    const raw = Array.isArray(cookieHeader) ? (cookieHeader[0] ?? "") : String(cookieHeader ?? "");
    return raw.split(";")[0] ?? "";
  }

  it("member recibe 403 al acceder a ruta requireAdmin", async () => {
    const cookie = await loginAs("alice@teimas.com", false);

    const res = await server.app.inject({
      method: "GET",
      url: "/api/admin/ping",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it("admin recibe 200 al acceder a ruta requireAdmin", async () => {
    const cookie = await loginAs("alice@teimas.com", true);

    const res = await server.app.inject({
      method: "GET",
      url: "/api/admin/ping",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
  });

  it("sin sesión recibe 401 al acceder a ruta requireAuth", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/admin/ping",
    });

    expect(res.statusCode).toBe(401);
  });
});
