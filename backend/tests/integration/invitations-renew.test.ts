import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../../src/http/server.js";
import { setupTestDb } from "../support/db.js";
import { parseEnv } from "../../src/config/env.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";

const testEnv = parseEnv({
  SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
  TEIMAS_DOMAINS: "teimas.com",
  ADMIN_EMAILS: "alice@teimas.com",
  TEST_AUTH: "on",
});

describe("POST /api/invitations/:id/renew", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const { db, cleanup } = setupTestDb();

  beforeAll(async () => {
    server = await buildServer({ db, env: testEnv, googleVerifier: new FakeGoogleVerifier() });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    cleanup();
  });

  async function adminCookie() {
    const res = await server.inject({
      method: "POST",
      url: "/api/test/session",
      body: { email: "alice@teimas.com", role: "admin" },
    });
    const raw = Array.isArray(res.headers["set-cookie"])
      ? (res.headers["set-cookie"][0] ?? "")
      : String(res.headers["set-cookie"] ?? "");
    return raw.split(";")[0] ?? "";
  }

  async function createInvitation(cookie: string, email: string) {
    const res = await server.inject({
      method: "POST",
      url: "/api/invitations",
      headers: { cookie },
      body: { email },
    });
    return res.json<{ id: number; expires_at: string; token: string }>();
  }

  // task 1.4.1
  it("renueva invitación caducada", async () => {
    const c = await adminCookie();
    const inv = await createInvitation(c, "expired@external.com");

    // Caducar manualmente
    db.exec(`UPDATE invitations SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ${inv.id}`);

    const res = await server.inject({
      method: "POST",
      url: `/api/invitations/${inv.id}/renew`,
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const updated = res.json<{ invitation: { expires_at: string; token: string; accepted_at: null } }>().invitation;
    expect(new Date(updated.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(updated.token).not.toBe(inv.token);
    expect(updated.accepted_at).toBeNull();
  });

  // task 1.4.2
  it("renueva invitación ya aceptada", async () => {
    const c = await adminCookie();
    const inv = await createInvitation(c, "accepted@external.com");

    // Marcar como aceptada
    db.exec(`UPDATE invitations SET accepted_at = '2026-01-01T00:00:00.000Z' WHERE id = ${inv.id}`);

    const res = await server.inject({
      method: "POST",
      url: `/api/invitations/${inv.id}/renew`,
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const updated = res.json<{ invitation: { accepted_at: null; token: string } }>().invitation;
    expect(updated.accepted_at).toBeNull();
    expect(updated.token).not.toBe(inv.token);
  });

  // task 1.4.3
  it("member recibe 403", async () => {
    const adminC = await adminCookie();
    const inv = await createInvitation(adminC, "another@external.com");

    const memberRes = await server.inject({
      method: "POST",
      url: "/api/test/session",
      body: { email: "member@teimas.com", role: "member" },
    });
    const memberRaw = Array.isArray(memberRes.headers["set-cookie"])
      ? (memberRes.headers["set-cookie"][0] ?? "")
      : String(memberRes.headers["set-cookie"] ?? "");
    const memberCookie = memberRaw.split(";")[0] ?? "";

    const res = await server.inject({
      method: "POST",
      url: `/api/invitations/${inv.id}/renew`,
      headers: { cookie: memberCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});
