import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

const METRICS_USER = "metrics";
const METRICS_PASS = "secret";

function basicAuth(user: string, pass: string): string {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

function makeEnv(mapsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
    BASIC_AUTH_METRICS_USER: METRICS_USER,
    BASIC_AUTH_METRICS_PASS: METRICS_PASS,
  });
}

async function getMetrics(server: TestServer): Promise<string> {
  const res = await server.app.inject({
    method: "GET",
    url: "/metrics",
    headers: { authorization: basicAuth(METRICS_USER, METRICS_PASS) },
  });
  return res.body;
}

function extractGauge(body: string, name: string, officeId: string): number {
  const re = new RegExp(`${name}\\{office_id="${officeId}"\\}\\s+(\\S+)`);
  const m = re.exec(body);
  return m ? parseFloat(m[1]) : 0;
}

async function loginAs(
  server: TestServer,
  verifier: FakeGoogleVerifier,
  email: string,
  sub: string,
): Promise<string> {
  verifier.setNextPayload({
    sub,
    email,
    hd: "teimas.com",
    name: email.split("@")[0],
    iss: "accounts.google.com",
    email_verified: true,
  } as never);
  const res = await server.app.inject({
    method: "POST",
    url: "/api/auth/google",
    body: { idToken: "fake" },
  });
  const cookieHeader = res.headers["set-cookie"];
  const raw = Array.isArray(cookieHeader) ? (cookieHeader[0] ?? "") : String(cookieHeader ?? "");
  return raw.split(";")[0] ?? "";
}

describe("vo_ws_connections_active", () => {
  let mapsDir: string;
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let officeId: number;
  let port: number;
  let cookie: string;

  beforeEach(async () => {
    mapsDir = mkdtempSync(join(tmpdir(), "vo-ws-metrics-"));
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    server = await startTestServer({ db: testDb.db, googleVerifier: verifier, env: makeEnv(mapsDir) });
    const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
    port = Number(new URL(address).port);

    cookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");

    officeId = (testDb.db.prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
       VALUES ('Test', 'map.tmj', 32, 32, 10, 10, 320, 320) RETURNING id`,
    ).get() as { id: number }).id;
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // task 2.6
  it("sube a 1 al conectar y vuelve a 0 al cerrar la conexión WS", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/offices/${officeId}`, {
      headers: { cookie },
    });

    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    await new Promise((r) => setTimeout(r, 50));

    const bodyConnected = await getMetrics(server);
    const countConnected = extractGauge(bodyConnected, "vo_ws_connections_active", String(officeId));
    expect(countConnected).toBe(1);

    ws.close();
    await new Promise<void>((resolve) => ws.once("close", resolve));
    await new Promise((r) => setTimeout(r, 50));

    const bodyDisconnected = await getMetrics(server);
    const countDisconnected = extractGauge(bodyDisconnected, "vo_ws_connections_active", String(officeId));
    expect(countDisconnected).toBe(0);
  });
});
