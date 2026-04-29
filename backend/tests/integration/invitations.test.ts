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
    PUBLIC_BASE_URL: "https://teimas.space",
    INVITATION_TTL_DAYS: "7",
    ...overrides,
  });
}

interface SetupOptions {
  isAdmin: boolean;
  email?: string;
}

async function setupAuthenticated(
  db: TestDb["db"],
  verifier: FakeGoogleVerifier,
  opts: SetupOptions,
): Promise<{ server: TestServer; cookie: string }> {
  const email = opts.email ?? "alice@teimas.com";
  const env = makeTestEnv({ ADMIN_EMAILS: opts.isAdmin ? email : "" });
  const server = await startTestServer({ db, googleVerifier: verifier as never, env });

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
  return { server, cookie: raw.split(";")[0] ?? "" };
}

describe("POST /api/invitations", () => {
  let testDb: TestDb;
  let server: TestServer;
  let cookie: string;
  let verifier: FakeGoogleVerifier;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    const setup = await setupAuthenticated(testDb.db, verifier, { isAdmin: true });
    server = setup.server;
    cookie = setup.cookie;
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("admin crea invitación con token y expires_at correcto", async () => {
    const before = Date.now();
    const res = await server.app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie },
      body: { email: "cliente@externo.com" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{
      id: number;
      email: string;
      token: string;
      expires_at: string;
      url: string;
    }>();
    expect(body.email).toBe("cliente@externo.com");
    expect(body.token).toHaveLength(43);
    expect(body.url).toBe(`https://teimas.space/invite/${body.token}`);

    const expiresMs = new Date(body.expires_at).getTime();
    const sevenDaysMs = 7 * 24 * 3600 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 5_000);
    expect(expiresMs).toBeLessThanOrEqual(before + sevenDaysMs + 5_000);
  });

  it("invitación a dominio Teimas devuelve 422 internal_domain", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie },
      body: { email: "compa@teimas.com" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("internal_domain");
  });

  it("invitación a usuario ya existente devuelve 409 already_user", async () => {
    testDb.db
      .prepare(
        "INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)",
      )
      .run("sub-existing", "socio@externo.com", "externo.com", "Socio", "member");

    const res = await server.app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie },
      body: { email: "socio@externo.com" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ reason: string }>().reason).toBe("already_user");
  });

  it("invitación duplicada renueva token sin duplicar fila", async () => {
    const first = await server.app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie },
      body: { email: "cliente@externo.com" },
    });
    const firstToken = first.json<{ token: string }>().token;

    const second = await server.app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie },
      body: { email: "cliente@externo.com" },
    });
    expect(second.statusCode).toBe(201);
    const secondToken = second.json<{ token: string }>().token;
    expect(secondToken).not.toBe(firstToken);

    const count = (
      testDb.db
        .prepare("SELECT COUNT(*) as c FROM invitations WHERE email = ?")
        .get("cliente@externo.com") as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("member intenta crear invitación → 403", async () => {
    await server.teardown();
    testDb.cleanup();
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    const memberSetup = await setupAuthenticated(testDb.db, verifier, { isAdmin: false });
    server = memberSetup.server;

    const res = await server.app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie: memberSetup.cookie },
      body: { email: "cliente@externo.com" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/invitations", () => {
  let testDb: TestDb;
  let server: TestServer;
  let cookie: string;
  let verifier: FakeGoogleVerifier;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    const setup = await setupAuthenticated(testDb.db, verifier, { isAdmin: true });
    server = setup.server;
    cookie = setup.cookie;

    const adminId = (
      testDb.db.prepare("SELECT id FROM users WHERE email = ?").get("alice@teimas.com") as {
        id: number;
      }
    ).id;
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    testDb.db
      .prepare(
        "INSERT INTO invitations (email, invited_by_user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run("viva@externo.com", adminId, "tok-viva", future);
    testDb.db
      .prepare(
        "INSERT INTO invitations (email, invited_by_user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run("expirada@externo.com", adminId, "tok-exp", past);
    testDb.db
      .prepare(
        "INSERT INTO invitations (email, invited_by_user_id, token, expires_at, accepted_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("aceptada@externo.com", adminId, "tok-acc", future, new Date().toISOString());
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("por defecto devuelve solo invitaciones vivas", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/invitations",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ email: string }>>();
    expect(body).toHaveLength(1);
    expect(body[0]?.email).toBe("viva@externo.com");
  });

  it("con ?include=all devuelve todas", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/api/invitations?include=all",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ email: string }>>();
    expect(body).toHaveLength(3);
  });
});

describe("POST /api/auth/google con inviteToken", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let liveToken: string;
  let expiredToken: string;
  let acceptedToken: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(),
    });

    testDb.db
      .prepare(
        "INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)",
      )
      .run("admin-sub", "admin@teimas.com", "teimas.com", "Admin", "admin");
    const adminId = (
      testDb.db.prepare("SELECT id FROM users WHERE email = ?").get("admin@teimas.com") as {
        id: number;
      }
    ).id;

    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    liveToken = "live-token-123456789012345678901234567";
    expiredToken = "expired-token-12345678901234567890";
    acceptedToken = "accepted-token-1234567890123456789";

    testDb.db
      .prepare(
        "INSERT INTO invitations (email, invited_by_user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run("cliente@externo.com", adminId, liveToken, future);
    testDb.db
      .prepare(
        "INSERT INTO invitations (email, invited_by_user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run("expirado@externo.com", adminId, expiredToken, past);
    testDb.db
      .prepare(
        "INSERT INTO invitations (email, invited_by_user_id, token, expires_at, accepted_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("aceptado@externo.com", adminId, acceptedToken, future, new Date().toISOString());
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("login externo con inviteToken válido → 200, is_invited_external=1, accepted_at marcado", async () => {
    verifier.setNextPayload({
      sub: "ext-sub-1",
      email: "cliente@externo.com",
      hd: undefined,
      name: "Cliente Externo",
      iss: "accounts.google.com",
      email_verified: true,
    } as never);

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake", inviteToken: liveToken },
    });

    expect(res.statusCode).toBe(200);

    const user = testDb.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get("cliente@externo.com") as { is_invited_external: number };
    expect(user.is_invited_external).toBe(1);

    const inv = testDb.db
      .prepare("SELECT accepted_at FROM invitations WHERE token = ?")
      .get(liveToken) as { accepted_at: string | null };
    expect(inv.accepted_at).not.toBeNull();
  });

  it("login externo con email distinto al de la invitación → 403 domain_not_allowed", async () => {
    verifier.setNextPayload({
      sub: "attacker-sub",
      email: "attacker@otro.com",
      hd: undefined,
      name: "Attacker",
      iss: "accounts.google.com",
      email_verified: true,
    } as never);

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake", inviteToken: liveToken },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ reason: string }>().reason).toBe("domain_not_allowed");

    const inv = testDb.db
      .prepare("SELECT accepted_at FROM invitations WHERE token = ?")
      .get(liveToken) as { accepted_at: string | null };
    expect(inv.accepted_at).toBeNull();
  });

  it("reuso del token tras aceptar → 410 invitation_already_used", async () => {
    verifier.setNextPayload({
      sub: "ext-sub-2",
      email: "aceptado@externo.com",
      hd: undefined,
      name: "Externo",
      iss: "accounts.google.com",
      email_verified: true,
    } as never);

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake", inviteToken: acceptedToken },
    });

    expect(res.statusCode).toBe(410);
    expect(res.json<{ reason: string }>().reason).toBe("invitation_already_used");
  });

  it("invitación caducada → 410 invitation_expired", async () => {
    verifier.setNextPayload({
      sub: "ext-sub-3",
      email: "expirado@externo.com",
      hd: undefined,
      name: "Externo",
      iss: "accounts.google.com",
      email_verified: true,
    } as never);

    const res = await server.app.inject({
      method: "POST",
      url: "/api/auth/google",
      body: { idToken: "fake", inviteToken: expiredToken },
    });

    expect(res.statusCode).toBe(410);
    expect(res.json<{ reason: string }>().reason).toBe("invitation_expired");
  });
});

describe("DELETE /api/invitations/:id", () => {
  let testDb: TestDb;
  let server: TestServer;
  let cookie: string;
  let verifier: FakeGoogleVerifier;
  let invitationId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    const setup = await setupAuthenticated(testDb.db, verifier, { isAdmin: true });
    server = setup.server;
    cookie = setup.cookie;

    const adminId = (
      testDb.db.prepare("SELECT id FROM users WHERE email = ?").get("alice@teimas.com") as {
        id: number;
      }
    ).id;
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    testDb.db
      .prepare(
        "INSERT INTO invitations (email, invited_by_user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run("revocar@externo.com", adminId, "tok-rev", future);
    invitationId = (
      testDb.db.prepare("SELECT id FROM invitations WHERE email = ?").get("revocar@externo.com") as {
        id: number;
      }
    ).id;
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
  });

  it("admin revoca invitación → 204 y desaparece del listado", async () => {
    const del = await server.app.inject({
      method: "DELETE",
      url: `/api/invitations/${invitationId}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(204);

    const list = await server.app.inject({
      method: "GET",
      url: "/api/invitations",
      headers: { cookie },
    });
    expect(list.json<Array<unknown>>()).toHaveLength(0);
  });

  it("member intenta revocar → 403", async () => {
    await server.teardown();
    testDb.cleanup();
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    const memberSetup = await setupAuthenticated(testDb.db, verifier, { isAdmin: false });
    server = memberSetup.server;

    const res = await server.app.inject({
      method: "DELETE",
      url: `/api/invitations/999`,
      headers: { cookie: memberSetup.cookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
