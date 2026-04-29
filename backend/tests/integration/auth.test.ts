import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

const BASE_DOMAINS = "teimas.com,teimas.es";

function makeTestEnv(overrides: Record<string, string> = {}) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: BASE_DOMAINS,
    ADMIN_EMAILS: "",
    ...overrides,
  });
}

function makePayload(overrides: Partial<{
  sub: string; email: string; hd: string; name: string;
  email_verified: boolean; picture: string;
}> = {}) {
  return {
    sub: "google-sub-1",
    email: "alice@teimas.com",
    hd: "teimas.com",
    name: "Alice",
    email_verified: true,
    picture: undefined,
    ...overrides,
  };
}

describe("POST /api/auth/google", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    process.env["TEIMAS_DOMAINS"] = BASE_DOMAINS;
    process.env["ADMIN_EMAILS"] = "";
    server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("con payload válido y hd permitido devuelve 200, set-cookie y user upsert", async () => {
    verifier.setNextPayload(makePayload());

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: number; email: string; role: string }>();
    expect(body.email).toBe("alice@teimas.com");
    expect(body.role).toBe("member");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(String(res.headers["set-cookie"])).toContain("session=");
    expect(String(res.headers["set-cookie"])).toContain("HttpOnly");
  });

  it("con hd no permitido devuelve 403 con reason domain_not_allowed", async () => {
    verifier.setNextPayload(makePayload({ hd: "otra.com", email: "x@otra.com" }));

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<{ reason: string }>();
    expect(body.reason).toBe("domain_not_allowed");
  });

  it("con email_verified=false devuelve 403 con reason email_not_verified", async () => {
    verifier.setNextPayload(makePayload({ email_verified: false }));

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<{ reason: string }>();
    expect(body.reason).toBe("email_not_verified");
  });

  it("token inválido (verifier lanza) devuelve 401 con reason invalid_token", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "bad-token" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json<{ reason: string }>();
    expect(body.reason).toBe("invalid_token");
  });

  it("rate limit dispara 429 al 11º request en la misma ventana", async () => {
    for (let i = 0; i < 10; i++) {
      await server.app.inject({
        method: "POST",
        url: "/api/auth/google",
        body: { idToken: "bad-token" },
      });
    }

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "bad-token" },
    });

    expect(res.statusCode).toBe(429);
  });
});

describe("GET /api/me", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    process.env["TEIMAS_DOMAINS"] = BASE_DOMAINS;
    process.env["ADMIN_EMAILS"] = "";
    server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  async function loginAndGetCookie(): Promise<string> {
    verifier.setNextPayload(makePayload());
    const loginRes = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });
    const cookieHeader = loginRes.headers["set-cookie"];
    return Array.isArray(cookieHeader) ? (cookieHeader[0] ?? "") : String(cookieHeader ?? "");
  }

  it("con cookie válida devuelve 200 con datos del usuario", async () => {
    const cookie = await loginAndGetCookie();
    const sessionToken = cookie.split(";")[0] ?? "";

    const res = await server.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { cookie: sessionToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ email: string }>();
    expect(body.email).toBe("alice@teimas.com");
  });

  it("sin cookie devuelve 401", async () => {
    const res = await server.app.inject({ method: "GET", url: "/api/me" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    process.env["TEIMAS_DOMAINS"] = BASE_DOMAINS;
    process.env["ADMIN_EMAILS"] = "";
    server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("limpia la cookie session", async () => {
    const res = await server.app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(res.statusCode).toBe(204);
    const cookie = String(res.headers["set-cookie"] ?? "");
    expect(cookie).toContain("session=");
    expect(cookie).toContain("Max-Age=0");
  });
});

describe("ADMIN_EMAILS bootstrap", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;

  beforeEach(() => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("primer login con email en ADMIN_EMAILS asigna role admin", async () => {
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv({ ADMIN_EMAILS: "alice@teimas.com" }),
    });

    verifier.setNextPayload(makePayload());
    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ role: string }>();
    expect(body.role).toBe("admin");
  });

  it("login posterior promueve a admin si email se añadió a ADMIN_EMAILS", async () => {
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv({ ADMIN_EMAILS: "" }),
    });

    verifier.setNextPayload(makePayload());
    const firstRes = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });
    expect(firstRes.json<{ role: string }>().role).toBe("member");

    await server.teardown();

    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv({ ADMIN_EMAILS: "alice@teimas.com" }),
    });

    verifier.setNextPayload(makePayload());
    const secondRes = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake-token" },
    });

    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.json<{ role: string }>().role).toBe("admin");
  });
});
