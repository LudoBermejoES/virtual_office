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

describe("GET /api/offices/:id/admins", () => {
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

  function login(email: string, role: "admin" | "member") {
    return server.inject({
      method: "POST",
      url: "/api/test/session",
      body: { email, role },
    });
  }

  async function cookie(email: string, role: "admin" | "member") {
    const res = await login(email, role);
    const raw = Array.isArray(res.headers["set-cookie"])
      ? (res.headers["set-cookie"][0] ?? "")
      : String(res.headers["set-cookie"] ?? "");
    return raw.split(";")[0] ?? "";
  }

  function seedOffice() {
    return (
      db
        .prepare(
          `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
           VALUES ('Test', 'map.tmj', 32, 32, 10, 10, 320, 320) RETURNING id`,
        )
        .get() as { id: number }
    ).id;
  }

  it("super-admin obtiene lista vacía cuando no hay office-admins", async () => {
    const officeId = seedOffice();
    const c = await cookie("alice@teimas.com", "admin");

    const res = await server.inject({
      method: "GET",
      url: `/api/offices/${officeId}/admins`,
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("super-admin obtiene lista con office-admins añadidos", async () => {
    const officeId = seedOffice();
    const alice = await cookie("alice@teimas.com", "admin");
    const bobLogin = await login("bob@teimas.com", "member");
    const bobId = (bobLogin.json() as { id: number }).id;

    // añadir bob como office-admin
    await server.inject({
      method: "POST",
      url: `/api/offices/${officeId}/admins`,
      headers: { cookie: alice },
      body: { user_id: bobId },
    });

    const res = await server.inject({
      method: "GET",
      url: `/api/offices/${officeId}/admins`,
      headers: { cookie: alice },
    });

    expect(res.statusCode).toBe(200);
    const list = res.json<{ user_id: number; email: string }[]>();
    expect(list.some((a) => a.user_id === bobId)).toBe(true);
  });

  it("member sin permisos recibe 403", async () => {
    const officeId = seedOffice();
    const c = await cookie("bob@teimas.com", "member");

    const res = await server.inject({
      method: "GET",
      url: `/api/offices/${officeId}/admins`,
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(403);
  });
});
