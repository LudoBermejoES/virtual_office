import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../../src/http/server.js";
import { setupTestDb } from "../support/db.js";
import { parseEnv } from "../../src/config/env.js";

const BASE_ENV = {
  SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
  TEIMAS_DOMAINS: "teimas.com",
  ADMIN_EMAILS: "alice@teimas.com",
};

const metricsEnv = parseEnv({
  ...BASE_ENV,
  BASIC_AUTH_METRICS_USER: "metrics",
  BASIC_AUTH_METRICS_PASS: "secret",
});

const noAuthEnv = parseEnv({ ...BASE_ENV });

function basicAuth(user: string, pass: string): string {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

describe("GET /metrics con Basic Auth configurado", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const { db, cleanup } = setupTestDb();

  beforeAll(async () => {
    server = await buildServer({ db, env: metricsEnv });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    cleanup();
  });

  // task 2.1
  it("devuelve 200 con Content-Type text/plain y contiene vo_http_requests_total", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: basicAuth("metrics", "secret") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.body).toContain("vo_http_requests_total");
  });

  // task 2.2
  it("devuelve 401 con WWW-Authenticate si no hay header Authorization", async () => {
    const res = await server.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/Basic realm/);
  });

  // task 2.3
  it("devuelve 401 con credenciales incorrectas", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: basicAuth("metrics", "wrong") },
    });
    expect(res.statusCode).toBe(401);
  });

  // task 2.5
  it("vo_http_requests_total se incrementa tras GET /api/me (401)", async () => {
    await server.inject({ method: "GET", url: "/api/me" });

    const res = await server.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: basicAuth("metrics", "secret") },
    });
    expect(res.body).toContain('vo_http_requests_total{');
    expect(res.body).toMatch(/vo_http_requests_total\{[^}]*method="GET"[^}]*\}/);
  });
});

// task 2.4
describe("GET /metrics sin env vars configuradas", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const { db, cleanup } = setupTestDb();

  beforeAll(async () => {
    server = await buildServer({ db, env: noAuthEnv });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    cleanup();
  });

  it("devuelve 503 cuando BASIC_AUTH_METRICS_USER no está configurado", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: basicAuth("metrics", "secret") },
    });
    expect(res.statusCode).toBe(503);
  });
});
