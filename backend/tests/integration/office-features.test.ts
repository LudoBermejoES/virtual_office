import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { makePng } from "../support/tiled-fixtures.js";
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

function buildMultipart(
  fields: Array<{ name: string; value: string } | { name: string; filename: string; contentType: string; data: Buffer }>,
): { body: Buffer; headers: Record<string, string> } {
  const boundary = `----vitest${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];
  for (const f of fields) {
    if ("value" in f) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`));
    } else {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`));
      parts.push(f.data);
      parts.push(Buffer.from("\r\n"));
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

function makeTmjWithFeatures(extraLayers: unknown[] = []): string {
  return JSON.stringify({
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    width: 20,
    height: 15,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    tilesets: [{ firstgid: 1, name: "office_tiles", image: "office_tiles.png", imagewidth: 256, imageheight: 256, tilewidth: 32, tileheight: 32 }],
    layers: [
      { type: "tilelayer", name: "ground", width: 20, height: 15, data: [0, 1, 2], encoding: "csv" },
      ...extraLayers,
    ],
  });
}

async function loginAdmin(server: TestServer, verifier: FakeGoogleVerifier): Promise<string> {
  verifier.setNextPayload({ sub: "admin-sub", email: "alice@teimas.com", hd: "teimas.com", name: "Admin", iss: "accounts.google.com", email_verified: true } as never);
  const res = await server.app.inject({ method: "POST", url: "/api/auth/google", body: { idToken: "fake" } });
  const raw = Array.isArray(res.headers["set-cookie"]) ? (res.headers["set-cookie"][0] ?? "") : String(res.headers["set-cookie"] ?? "");
  return raw.split(";")[0] ?? "";
}

async function uploadOffice(server: TestServer, cookie: string, tmjStr: string) {
  const png = makePng(64, 64);
  const mp = buildMultipart([
    { name: "name", value: "Test Office" },
    { name: "tmj", filename: "map.tmj", contentType: "application/json", data: Buffer.from(tmjStr) },
    { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: png },
  ]);
  return server.app.inject({ method: "POST", url: "/api/offices", headers: { ...mp.headers, cookie }, payload: mp.body });
}

type OfficeSnapshot = {
  features?: { zones: { name: string; kind: string; geometry: unknown }[]; rooms: unknown[]; labels: { name: string; font: string; size: number }[] };
};

describe("office features — integración", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let cookie: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-features-"));
    server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never, env: makeTestEnv(mapsDir) });
    cookie = await loginAdmin(server, verifier);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // 3.1 — Subir .tmj con zonas + rooms + labels → GET devuelve features
  it("sube .tmj con zonas y labels → GET /api/offices/:id incluye features", async () => {
    const tmj = makeTmjWithFeatures([
      {
        type: "objectgroup",
        name: "zones",
        objects: [
          { id: 1, name: "Cocina", x: 64, y: 96, width: 128, height: 64, properties: [{ name: "kind", type: "string", value: "kitchen" }] },
        ],
      },
      {
        type: "objectgroup",
        name: "labels",
        objects: [
          { id: 2, name: "Mar", x: 200, y: 100, point: true, properties: [{ name: "font", type: "string", value: "display" }, { name: "size", type: "int", value: 24 }] },
        ],
      },
    ]);

    const uploadRes = await uploadOffice(server, cookie, tmj);
    expect(uploadRes.statusCode).toBe(201);
    const officeId = uploadRes.json<{ office: { id: number } }>().office.id;

    const getRes = await server.app.inject({ method: "GET", url: `/api/offices/${officeId}`, headers: { cookie } });
    expect(getRes.statusCode).toBe(200);
    const snap = getRes.json<OfficeSnapshot>();

    expect(snap.features).toBeDefined();
    expect(snap.features?.zones).toHaveLength(1);
    expect(snap.features?.zones[0]).toMatchObject({ name: "Cocina", kind: "kitchen" });
    expect(snap.features?.labels).toHaveLength(1);
    expect(snap.features?.labels[0]).toMatchObject({ name: "Mar", font: "display", size: 24 });
  });

  // 3.2 — Sin features → campo viene como { zones: [], rooms: [], labels: [] }
  it("oficina sin object layers devuelve features vacías", async () => {
    const tmj = makeTmjWithFeatures([]);
    const uploadRes = await uploadOffice(server, cookie, tmj);
    expect(uploadRes.statusCode).toBe(201);
    const officeId = uploadRes.json<{ office: { id: number } }>().office.id;

    const getRes = await server.app.inject({ method: "GET", url: `/api/offices/${officeId}`, headers: { cookie } });
    const snap = getRes.json<OfficeSnapshot>();
    expect(snap.features).toEqual({ zones: [], rooms: [], labels: [] });
  });

  // 3.3 — Re-subida elimina features antiguas y reinserta nuevas
  it("re-subida del mapa reemplaza las features anteriores", async () => {
    const tmjV1 = makeTmjWithFeatures([
      { type: "objectgroup", name: "zones", objects: [
        { id: 1, name: "Cocina", x: 64, y: 96, width: 128, height: 64, properties: [{ name: "kind", type: "string", value: "kitchen" }] },
      ]},
    ]);
    const uploadRes = await uploadOffice(server, cookie, tmjV1);
    const officeId = uploadRes.json<{ office: { id: number } }>().office.id;

    const tmjV2 = makeTmjWithFeatures([
      { type: "objectgroup", name: "zones", objects: [
        { id: 2, name: "Sala Reuniones", x: 10, y: 10, width: 100, height: 100, properties: [{ name: "kind", type: "string", value: "meeting" }] },
      ]},
    ]);
    const png = makePng(64, 64);
    const mp2 = buildMultipart([
      { name: "name", value: "Test Office" },
      { name: "tmj", filename: "map.tmj", contentType: "application/json", data: Buffer.from(tmjV2) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: png },
    ]);
    await server.app.inject({ method: "PATCH", url: `/api/offices/${officeId}`, headers: { ...mp2.headers, cookie }, payload: mp2.body });

    const getRes = await server.app.inject({ method: "GET", url: `/api/offices/${officeId}`, headers: { cookie } });
    const snap = getRes.json<OfficeSnapshot>();
    expect(snap.features?.zones).toHaveLength(1);
    expect(snap.features?.zones[0]?.name).toBe("Sala Reuniones");
  });
});
