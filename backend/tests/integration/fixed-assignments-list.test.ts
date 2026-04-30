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

describe("GET /api/offices/:id/fixed-assignments", () => {
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

  async function loginAndGetId(email: string, role: "admin" | "member") {
    const res = await server.inject({
      method: "POST",
      url: "/api/test/session",
      body: { email, role },
    });
    const raw = Array.isArray(res.headers["set-cookie"])
      ? (res.headers["set-cookie"][0] ?? "")
      : String(res.headers["set-cookie"] ?? "");
    return { cookie: raw.split(";")[0] ?? "", id: (res.json() as { id: number }).id };
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

  function seedDesk(officeId: number, label: string) {
    return (
      db
        .prepare(
          `INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, 10, 10, 'manual') RETURNING id`,
        )
        .get(officeId, label) as { id: number }
    ).id;
  }

  // task 1.5.1
  it("devuelve asignaciones fijas con datos de puesto y usuario", async () => {
    const officeId = seedOffice();
    const alice = await loginAndGetId("alice@teimas.com", "admin");
    const bob = await loginAndGetId("bob2@teimas.com", "member");
    const deskId = seedDesk(officeId, "A1");

    // asignar fijo desde la API
    await server.inject({
      method: "POST",
      url: `/api/desks/${deskId}/fixed`,
      headers: { cookie: alice.cookie },
      body: { userId: bob.id },
    });

    const res = await server.inject({
      method: "GET",
      url: `/api/offices/${officeId}/fixed-assignments`,
      headers: { cookie: alice.cookie },
    });

    expect(res.statusCode).toBe(200);
    const list = res.json<{
      id: number;
      desk: { id: number; label: string };
      user: { id: number; name: string; email: string };
      assigned_by: { id: number; name: string };
      created_at: string;
    }[]>();

    expect(list).toHaveLength(1);
    expect(list[0].desk.label).toBe("A1");
    expect(list[0].user.id).toBe(bob.id);
    expect(list[0].assigned_by).toBeDefined();
    expect(list[0].created_at).toBeDefined();
  });

  it("member sin permisos recibe 403", async () => {
    const officeId = seedOffice();
    const bob = await loginAndGetId("bob3@teimas.com", "member");

    const res = await server.inject({
      method: "GET",
      url: `/api/offices/${officeId}/fixed-assignments`,
      headers: { cookie: bob.cookie },
    });

    expect(res.statusCode).toBe(403);
  });
});
