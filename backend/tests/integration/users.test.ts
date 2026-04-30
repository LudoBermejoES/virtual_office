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

describe("GET /api/users", () => {
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

  async function cookie(email: string, role: "admin" | "member") {
    const res = await server.inject({
      method: "POST",
      url: "/api/test/session",
      body: { email, role },
    });
    const raw = Array.isArray(res.headers["set-cookie"])
      ? (res.headers["set-cookie"][0] ?? "")
      : String(res.headers["set-cookie"] ?? "");
    return raw.split(";")[0] ?? "";
  }

  // task 1.2.1
  it("admin obtiene lista de usuarios", async () => {
    const c = await cookie("alice@teimas.com", "admin");
    await cookie("bob@teimas.com", "member");

    const res = await server.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const list = res.json<{ id: number; email: string; role: string }[]>();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((u) => u.email === "alice@teimas.com")).toBe(true);
    expect(list.some((u) => u.email === "bob@teimas.com")).toBe(true);
    expect(list[0]).toHaveProperty("id");
    expect(list[0]).toHaveProperty("name");
    expect(list[0]).toHaveProperty("role");
    expect(list[0]).toHaveProperty("created_at");
  });

  it("member recibe 403", async () => {
    const c = await cookie("bob@teimas.com", "member");
    const res = await server.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: c },
    });
    expect(res.statusCode).toBe(403);
  });

  // task 1.2.2
  it("GET /api/users?email= filtra por email", async () => {
    const c = await cookie("alice@teimas.com", "admin");
    await cookie("carol@teimas.com", "member");

    const res = await server.inject({
      method: "GET",
      url: "/api/users?email=carol@teimas.com",
      headers: { cookie: c },
    });

    expect(res.statusCode).toBe(200);
    const list = res.json<{ email: string }[]>();
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe("carol@teimas.com");
  });

  it("GET /api/users?email= devuelve array vacío si no existe", async () => {
    const c = await cookie("alice@teimas.com", "admin");
    const res = await server.inject({
      method: "GET",
      url: "/api/users?email=nobody@teimas.com",
      headers: { cookie: c },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe("PATCH /api/users/:id", () => {
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

  // task 1.3.1
  it("super-admin promueve usuario a admin", async () => {
    const alice = await loginAndGetId("alice@teimas.com", "admin");
    const bob = await loginAndGetId("bob@teimas.com", "member");

    const res = await server.inject({
      method: "PATCH",
      url: `/api/users/${bob.id}`,
      headers: { cookie: alice.cookie },
      body: { role: "admin" },
    });

    expect(res.statusCode).toBe(200);

    const check = await server.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: alice.cookie },
    });
    const list = check.json<{ id: number; role: string }[]>();
    expect(list.find((u) => u.id === bob.id)?.role).toBe("admin");
  });

  // task 1.3.2
  it("member recibe 403 al intentar cambiar rol", async () => {
    const dave = await loginAndGetId("dave@teimas.com", "member");
    const eve = await loginAndGetId("eve@teimas.com", "member");

    const res = await server.inject({
      method: "PATCH",
      url: `/api/users/${eve.id}`,
      headers: { cookie: dave.cookie },
      body: { role: "admin" },
    });

    expect(res.statusCode).toBe(403);
  });
});
