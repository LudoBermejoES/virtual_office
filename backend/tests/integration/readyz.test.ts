import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../../src/http/server.js";
import { setupTestDb } from "../support/db.js";
import { parseEnv } from "../../src/config/env.js";

const testEnv = parseEnv({
  SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
  TEIMAS_DOMAINS: "teimas.com",
  ADMIN_EMAILS: "alice@teimas.com",
});

// task 3.1 — todas las migraciones aplicadas → 200
describe("GET /readyz con todas las migraciones aplicadas", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const { db, cleanup } = setupTestDb();

  beforeAll(async () => {
    server = await buildServer({ db, env: testEnv });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    cleanup();
  });

  it("devuelve 200 { status: 'ready' }", async () => {
    const res = await server.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string }>();
    expect(body.status).toBe("ready");
  });
});

// task 3.2 — migración sintética faltante → 503
describe("GET /readyz con migración faltante", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const { db, cleanup } = setupTestDb();

  beforeAll(async () => {
    // Insertar una migración sintética que no existe en el manifest
    db.exec("INSERT INTO _migrations (version) VALUES (9999)");
    server = await buildServer({ db, env: testEnv });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    cleanup();
  });

  it("devuelve 503 con status degraded y reason migrations_pending cuando falta una migración esperada", async () => {
    // Eliminar la versión 1 del registro para simular que falta
    db.exec("DELETE FROM _migrations WHERE version = 1");

    const res = await server.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    const body = res.json<{ status: string; reason: string; missing: number[] }>();
    expect(body.status).toBe("degraded");
    expect(body.reason).toBe("migrations_pending");
    expect(body.missing).toContain(1);
  });
});
