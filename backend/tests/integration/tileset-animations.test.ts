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
  fields: Array<
    | { name: string; value: string }
    | { name: string; filename: string; contentType: string; data: Buffer }
  >,
): { body: Buffer; headers: Record<string, string> } {
  const boundary = `----vitest${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];
  for (const f of fields) {
    if ("value" in f) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`,
        ),
      );
    } else {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`,
        ),
      );
      parts.push(f.data);
      parts.push(Buffer.from("\r\n"));
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

function makeTmjWithAnimations(animations: { tileId: number; frames: { tileid: number; duration: number }[] }[]): string {
  const tiles = animations.map((a) => ({ id: a.tileId, animation: a.frames }));
  return JSON.stringify({
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    width: 20,
    height: 15,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    tilesets: [
      {
        firstgid: 1,
        name: "office_tiles",
        image: "office_tiles.png",
        imagewidth: 256,
        imageheight: 256,
        tilewidth: 32,
        tileheight: 32,
        tiles,
      },
    ],
    layers: [{ type: "tilelayer", name: "ground", width: 20, height: 15, data: [1, 2, 3], encoding: "csv" }],
  });
}

function makeTmjWithNpcs(npcs: { name: string; sprite: string }[], extraNpcs: number = 0): string {
  const npcObjects = npcs.map((n, i) => ({
    id: i + 1,
    name: n.name,
    x: i * 32,
    y: 0,
    point: true,
    properties: [{ name: "sprite", type: "string", value: n.sprite }],
  }));
  // Añadir NPCs extra para test de límite
  for (let i = 0; i < extraNpcs; i++) {
    npcObjects.push({
      id: npcs.length + i + 1,
      name: `Extra ${i}`,
      x: i * 32,
      y: 32,
      point: true,
      properties: [{ name: "sprite", type: "string", value: "cat-idle" }],
    });
  }
  return JSON.stringify({
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    width: 20,
    height: 15,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    tilesets: [
      {
        firstgid: 1,
        name: "office_tiles",
        image: "office_tiles.png",
        imagewidth: 256,
        imageheight: 256,
        tilewidth: 32,
        tileheight: 32,
      },
    ],
    layers: [
      { type: "tilelayer", name: "ground", width: 20, height: 15, data: [1, 2, 3], encoding: "csv" },
      {
        type: "objectgroup",
        name: "npcs",
        objects: npcObjects,
      },
    ],
  });
}

async function loginAdmin(server: TestServer, verifier: FakeGoogleVerifier): Promise<string> {
  verifier.setNextPayload({
    sub: "admin-sub",
    email: "alice@teimas.com",
    hd: "teimas.com",
    name: "Admin",
    iss: "accounts.google.com",
    email_verified: true,
  } as never);
  const res = await server.app.inject({
    method: "POST",
    url: "/api/auth/google",
    body: { idToken: "fake" },
  });
  const raw = Array.isArray(res.headers["set-cookie"])
    ? (res.headers["set-cookie"][0] ?? "")
    : String(res.headers["set-cookie"] ?? "");
  return raw.split(";")[0] ?? "";
}

async function uploadOffice(server: TestServer, cookie: string, tmjStr: string) {
  const png = makePng(64, 64);
  const mp = buildMultipart([
    { name: "name", value: "Test Office" },
    { name: "tmj", filename: "map.tmj", contentType: "application/json", data: Buffer.from(tmjStr) },
    { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: png },
  ]);
  return server.app.inject({
    method: "POST",
    url: "/api/offices",
    headers: { ...mp.headers, cookie },
    payload: mp.body,
  });
}

describe("tileset animations — integración", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let cookie: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-anim-"));
    server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never, env: makeTestEnv(mapsDir) });
    cookie = await loginAdmin(server, verifier);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // 1.1 — Mapa con tile animado se persiste y devuelve en GET
  it("mapa con tile animado: GET devuelve las animaciones del tileset", async () => {
    const frames = [
      { tileid: 0, duration: 200 },
      { tileid: 1, duration: 200 },
      { tileid: 2, duration: 200 },
      { tileid: 3, duration: 200 },
    ];
    const tmj = makeTmjWithAnimations([{ tileId: 0, frames }]);

    const uploadRes = await uploadOffice(server, cookie, tmj);
    expect(uploadRes.statusCode).toBe(201);
    const officeId = uploadRes.json<{ office: { id: number } }>().office.id;

    const getRes = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie },
    });
    expect(getRes.statusCode).toBe(200);
    const body = getRes.json<{ tilesets: Array<{ animations: unknown[] }> }>();
    expect(body.tilesets[0]?.animations).toBeDefined();
    expect(body.tilesets[0]?.animations).toHaveLength(1);
    const anim = (body.tilesets[0]?.animations as Array<{ tileId: number; frames: unknown[] }>)[0]!;
    expect(anim.tileId).toBe(0);
    expect(anim.frames).toHaveLength(4);
  });

  it("mapa sin animaciones devuelve animations vacío", async () => {
    const tmj = makeTmjWithAnimations([]);
    const uploadRes = await uploadOffice(server, cookie, tmj);
    expect(uploadRes.statusCode).toBe(201);
    const officeId = uploadRes.json<{ office: { id: number } }>().office.id;

    const getRes = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie },
    });
    const body = getRes.json<{ tilesets: Array<{ animations: unknown[] }> }>();
    expect(body.tilesets[0]?.animations).toEqual([]);
  });
});

describe("NPCs — integración", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let cookie: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-npc-"));
    server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never, env: makeTestEnv(mapsDir) });
    cookie = await loginAdmin(server, verifier);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  // 3.1 — sprite conocido persiste, sprite desconocido se descarta con warning
  it("sprite='cat-idle' persiste; sprite='dragon' se descarta con warning", async () => {
    const tmj = makeTmjWithNpcs([
      { name: "Gatito", sprite: "cat-idle" },
      { name: "Dragon", sprite: "dragon" },
    ]);

    const uploadRes = await uploadOffice(server, cookie, tmj);
    expect(uploadRes.statusCode).toBe(201);
    const officeId = uploadRes.json<{ office: { id: number } }>().office.id;

    const getRes = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie },
    });
    const body = getRes.json<{ npcs: Array<{ name: string; sprite: string }> }>();
    expect(body.npcs).toHaveLength(1);
    expect(body.npcs[0]?.name).toBe("Gatito");
    expect(body.npcs[0]?.sprite).toBe("cat-idle");
  });

  // 3.2 — 51 NPCs devuelve 413
  it("51 NPCs en el mapa devuelve 413 too_many_npcs", async () => {
    const tmj = makeTmjWithNpcs([{ name: "Gato0", sprite: "cat-idle" }], 50); // 1 + 50 = 51
    const uploadRes = await uploadOffice(server, cookie, tmj);
    expect(uploadRes.statusCode).toBe(413);
    expect(uploadRes.json<{ reason: string }>().reason).toBe("too_many_npcs");
  });
});
