import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { addDaysIso, todayIso } from "../../src/domain/bookings.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
  });
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

function seed(db: TestDb["db"]): { officeId: number; deskIds: number[]; bobId: number } {
  const oRes = db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", "map.tmj", 32, 32, 25, 19, 800, 608);
  const officeId = Number(oRes.lastInsertRowid);
  const deskIds: number[] = [];
  for (let i = 0; i < 2; i++) {
    const d = db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, `D${i + 1}`, 100 + i * 80, 100, "manual");
    deskIds.push(Number(d.lastInsertRowid));
  }
  const bob = db
    .prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?, ?, ?, ?, ?)")
    .run("bob-seed", "bob-seed@teimas.com", "teimas.com", "BobSeed", "member");
  return { officeId, deskIds, bobId: Number(bob.lastInsertRowid) };
}

interface WsClient {
  socket: WebSocket;
  messages: unknown[];
  close: () => void;
}

async function connectWs(
  port: number,
  officeId: number,
  cookie: string | null,
): Promise<WsClient> {
  const messages: unknown[] = [];
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/offices/${officeId}`, {
    headers: cookie ? { cookie } : {},
  });
  socket.on("message", (raw: Buffer) => {
    try {
      messages.push(JSON.parse(raw.toString()));
    } catch {
      // mensajes binarios o malformados
    }
  });
  return {
    socket,
    messages,
    close: () => socket.close(1000),
  };
}

async function waitForOpenOrClose(
  socket: WebSocket,
): Promise<{ opened: true } | { opened: false; code: number }> {
  return new Promise((resolve) => {
    socket.once("open", () => resolve({ opened: true }));
    socket.once("close", (code: number) => resolve({ opened: false, code }));
  });
}

async function waitForMessageCount(client: WsClient, expected: number): Promise<void> {
  const start = Date.now();
  while (client.messages.length < expected && Date.now() - start < 2000) {
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe("WS /ws/offices/:id", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let aliceCookie: string;
  let officeId: number;
  let deskIds: number[];
  let bobId: number;
  let port: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-ws-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    aliceCookie = await loginAs(server, verifier, "alice@teimas.com", "alice-sub");
    ({ officeId, deskIds, bobId } = seed(testDb.db));

    const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
    const url = new URL(address);
    port = Number(url.port);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("conectar sin cookie cierra con 4001", async () => {
    const client = await connectWs(port, officeId, null);
    const result = await waitForOpenOrClose(client.socket);
    if (result.opened) {
      // El servidor pudo aceptar el upgrade y cerrar inmediatamente
      const closeCode = await new Promise<number>((resolve) => {
        client.socket.once("close", (code: number) => resolve(code));
      });
      expect(closeCode).toBe(4001);
    } else {
      // El upgrade fue rechazado antes de abrir
      expect([4001, 1006]).toContain(result.code);
    }
  });

  it("conectar con cookie inválida cierra con 4001", async () => {
    const client = await connectWs(port, officeId, "session=invalid-token");
    const result = await waitForOpenOrClose(client.socket);
    if (result.opened) {
      const closeCode = await new Promise<number>((resolve) => {
        client.socket.once("close", (code: number) => resolve(code));
      });
      expect(closeCode).toBe(4001);
    } else {
      expect([4001, 1006]).toContain(result.code);
    }
  });

  it("conectar con cookie válida emite snapshot.ts", async () => {
    const client = await connectWs(port, officeId, aliceCookie);
    await waitForOpenOrClose(client.socket);
    await waitForMessageCount(client, 1);
    expect(client.messages[0]).toMatchObject({ type: "snapshot.ts" });
    client.close();
  });

  it("POST /api/desks/:id/bookings produce desk.booked en el room", async () => {
    const client = await connectWs(port, officeId, aliceCookie);
    await waitForOpenOrClose(client.socket);
    await waitForMessageCount(client, 1);

    const date = addDaysIso(todayIso(), 1);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    expect(res.statusCode).toBe(201);

    await waitForMessageCount(client, 2);
    const bookEvent = client.messages.find(
      (m): m is { type: string; deskId: number; date: string } =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "desk.booked",
    );
    expect(bookEvent).toBeDefined();
    expect(bookEvent!.deskId).toBe(deskIds[0]);
    expect(bookEvent!.date).toBe(date);
    client.close();
  });

  it("DELETE produce desk.released", async () => {
    const date = addDaysIso(todayIso(), 1);
    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });

    const client = await connectWs(port, officeId, aliceCookie);
    await waitForOpenOrClose(client.socket);
    await waitForMessageCount(client, 1);

    await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskIds[0]}/bookings`,
      headers: { cookie: aliceCookie },
      body: { date },
    });
    await waitForMessageCount(client, 2);
    const released = client.messages.find(
      (m) => typeof m === "object" && m !== null && (m as { type?: string }).type === "desk.released",
    );
    expect(released).toBeDefined();
    client.close();
  });

  it("POST /api/desks/:id/fixed produce desk.fixed", async () => {
    const client = await connectWs(port, officeId, aliceCookie);
    await waitForOpenOrClose(client.socket);
    await waitForMessageCount(client, 1);

    await server.app.inject({
      method: "POST",
      url: `/api/desks/${deskIds[0]}/fixed`,
      headers: { cookie: aliceCookie },
      body: { userId: bobId },
    });
    await waitForMessageCount(client, 2);
    const fixed = client.messages.find(
      (m) => typeof m === "object" && m !== null && (m as { type?: string }).type === "desk.fixed",
    );
    expect(fixed).toBeDefined();
    expect((fixed as { user: { name: string } }).user.name).toBe("BobSeed");
    client.close();
  });
});
