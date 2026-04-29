import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { makeTmj, makePng } from "../support/tiled-fixtures.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function buildMultipart(
  fields: Array<{ name: string; value: string } | { name: string; filename: string; contentType: string; data: Buffer }>,
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
  const body = Buffer.concat(parts);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

function makeTestEnv(mapsDir: string): ReturnType<typeof parseEnv> {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
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
  const cookieHeader = res.headers["set-cookie"];
  const raw = Array.isArray(cookieHeader) ? (cookieHeader[0] ?? "") : String(cookieHeader ?? "");
  return raw.split(";")[0] ?? "";
}

async function loginMember(server: TestServer, verifier: FakeGoogleVerifier): Promise<string> {
  verifier.setNextPayload({
    sub: "member-sub",
    email: "bob@teimas.com",
    hd: "teimas.com",
    name: "Member",
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

describe("offices upload", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let cookie: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-offices-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    cookie = await loginAdmin(server, verifier);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("POST /api/offices con bundle válido devuelve 201 y persiste oficina + tileset", async () => {
    const tmj = Buffer.from(makeTmj());
    const png = makePng(64, 64);
    const { body, headers } = buildMultipart([
      { name: "name", value: "HQ" },
      { name: "tmj", filename: "office.tmj", contentType: "application/json", data: tmj },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: png },
    ]);

    const res = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...headers, cookie },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const data = res.json<{
      office: {
        id: number;
        name: string;
        tile_width: number;
        tile_height: number;
        cells_x: number;
        cells_y: number;
        map_width: number;
        map_height: number;
        tilesets: Array<{ ordinal: number; image_name: string; filename: string }>;
      };
    }>();
    expect(data.office.name).toBe("HQ");
    expect(data.office.tile_width).toBe(32);
    expect(data.office.cells_x).toBe(20);
    expect(data.office.tilesets).toHaveLength(1);
    expect(data.office.tilesets[0]?.image_name).toBe("office_tiles.png");

    const files = readdirSync(join(mapsDir, String(data.office.id)));
    expect(files.some((f) => /^map_[a-f0-9]{12}\.tmj$/.test(f))).toBe(true);
    expect(files.some((f) => /^tile_0_[a-f0-9]{12}\.png$/.test(f))).toBe(true);
  });

  it("POST con tmj malformado devuelve 422 invalid_tmj", async () => {
    const tmj = Buffer.from("{not json");
    const { body, headers } = buildMultipart([
      { name: "name", value: "Bad" },
      { name: "tmj", filename: "bad.tmj", contentType: "application/json", data: tmj },
      { name: "tilesets", filename: "x.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const res = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...headers, cookie },
      payload: body,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("invalid_tmj");
  });

  it("POST con tileset referenciado faltante devuelve 422 tileset_mismatch", async () => {
    const tmj = Buffer.from(
      makeTmj({
        tilesets: [{ image: "office_tiles.png" }, { image: "walls.png" }],
      }),
    );
    const { body, headers } = buildMultipart([
      { name: "name", value: "X" },
      { name: "tmj", filename: "office.tmj", contentType: "application/json", data: tmj },
      {
        name: "tilesets",
        filename: "office_tiles.png",
        contentType: "image/png",
        data: makePng(64, 64),
      },
    ]);
    const res = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...headers, cookie },
      payload: body,
    });
    expect(res.statusCode).toBe(422);
    const json = res.json<{ reason: string; details: string[] }>();
    expect(json.reason).toBe("tileset_mismatch");
    expect(json.details.some((d) => d.includes("walls.png"))).toBe(true);
  });

  it("POST con tileset extra devuelve 422 tileset_mismatch", async () => {
    const tmj = Buffer.from(makeTmj());
    const { body, headers } = buildMultipart([
      { name: "name", value: "X" },
      { name: "tmj", filename: "office.tmj", contentType: "application/json", data: tmj },
      {
        name: "tilesets",
        filename: "office_tiles.png",
        contentType: "image/png",
        data: makePng(64, 64),
      },
      {
        name: "tilesets",
        filename: "extra.png",
        contentType: "image/png",
        data: makePng(64, 64),
      },
    ]);
    const res = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...headers, cookie },
      payload: body,
    });
    expect(res.statusCode).toBe(422);
    const json = res.json<{ reason: string; details: string[] }>();
    expect(json.reason).toBe("tileset_mismatch");
    expect(json.details.some((d) => d.includes("extra.png"))).toBe(true);
  });

  it("POST con MIME no permitido devuelve 415", async () => {
    const tmj = Buffer.from(makeTmj());
    // Buffer arbitrario que no es png/webp
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const { body, headers } = buildMultipart([
      { name: "name", value: "X" },
      { name: "tmj", filename: "office.tmj", contentType: "application/json", data: tmj },
      {
        name: "tilesets",
        filename: "office_tiles.png",
        contentType: "image/png",
        data: fakeJpeg,
      },
    ]);
    const res = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...headers, cookie },
      payload: body,
    });
    expect(res.statusCode).toBe(415);
  });

  it("POST con tileset menor que tile_width × tile_height devuelve 422 tileset_too_small", async () => {
    const tmj = Buffer.from(makeTmj({ tilewidth: 32, tileheight: 32 }));
    const tinyPng = makePng(16, 16);
    const { body, headers } = buildMultipart([
      { name: "name", value: "X" },
      { name: "tmj", filename: "office.tmj", contentType: "application/json", data: tmj },
      {
        name: "tilesets",
        filename: "office_tiles.png",
        contentType: "image/png",
        data: tinyPng,
      },
    ]);
    const res = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...headers, cookie },
      payload: body,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("tileset_too_small");
  });

  it("Member intenta POST → 403", async () => {
    const memberCookie = await loginMember(server, verifier);
    const tmj = Buffer.from(makeTmj());
    const { body, headers } = buildMultipart([
      { name: "tmj", filename: "x.tmj", contentType: "application/json", data: tmj },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const res = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...headers, cookie: memberCookie },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
  });

  it("PATCH /api/offices/:id preserva los desks existentes", async () => {
    const m1 = buildMultipart([
      { name: "name", value: "HQ" },
      { name: "tmj", filename: "a.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const create = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...m1.headers, cookie },
      payload: m1.body,
    });
    const officeId = create.json<{ office: { id: number } }>().office.id;

    testDb.db
      .prepare(
        "INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)",
      )
      .run(officeId, "D1", 100, 100, "manual");

    const m2 = buildMultipart([
      { name: "tmj", filename: "v2.tmj", contentType: "application/json", data: Buffer.from(makeTmj({ tilesets: [{ image: "v2.png" }] })) },
      { name: "tilesets", filename: "v2.png", contentType: "image/png", data: makePng(128, 128) },
    ]);
    const patch = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}`,
      headers: { ...m2.headers, cookie },
      payload: m2.body,
    });
    expect(patch.statusCode).toBe(200);

    const desks = testDb.db
      .prepare("SELECT label FROM desks WHERE office_id = ?")
      .all(officeId) as { label: string }[];
    expect(desks).toHaveLength(1);
    expect(desks[0]?.label).toBe("D1");
  });

  it("PATCH /api/offices/:id reemplaza el bundle", async () => {
    const tmj1 = Buffer.from(makeTmj());
    const m1 = buildMultipart([
      { name: "name", value: "HQ" },
      { name: "tmj", filename: "a.tmj", contentType: "application/json", data: tmj1 },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const create = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...m1.headers, cookie },
      payload: m1.body,
    });
    const officeId = create.json<{ office: { id: number } }>().office.id;

    const tmj2 = Buffer.from(makeTmj({ width: 30, height: 20, tilesets: [{ image: "v2.png" }] }));
    const m2 = buildMultipart([
      { name: "tmj", filename: "v2.tmj", contentType: "application/json", data: tmj2 },
      { name: "tilesets", filename: "v2.png", contentType: "image/png", data: makePng(128, 128) },
    ]);
    const patch = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}`,
      headers: { ...m2.headers, cookie },
      payload: m2.body,
    });
    expect(patch.statusCode).toBe(200);
    const updated = patch.json<{ office: { cells_x: number; tilesets: Array<{ image_name: string }> } }>();
    expect(updated.office.cells_x).toBe(30);
    expect(updated.office.tilesets[0]?.image_name).toBe("v2.png");
  });

  it("GET /api/offices autenticado lista oficinas con tilesets", async () => {
    const m = buildMultipart([
      { name: "name", value: "HQ" },
      { name: "tmj", filename: "a.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...m.headers, cookie },
      payload: m.body,
    });

    const res = await server.app.inject({ method: "GET", url: "/api/offices", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const list = res.json<Array<{ name: string; tilesets: Array<unknown> }>>();
    expect(list).toHaveLength(1);
    expect(list[0]?.tilesets).toHaveLength(1);
  });

  it("GET /api/offices/:id devuelve detalle con tilesets y desks vacíos", async () => {
    const m = buildMultipart([
      { name: "name", value: "HQ" },
      { name: "tmj", filename: "a.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const create = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...m.headers, cookie },
      payload: m.body,
    });
    const officeId = create.json<{ office: { id: number } }>().office.id;

    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json<{ office: unknown; tilesets: Array<unknown>; desks: Array<unknown> }>();
    expect(data.tilesets).toHaveLength(1);
    expect(data.desks).toEqual([]);
  });

  it("GET /api/offices sin sesión → 401", async () => {
    const res = await server.app.inject({ method: "GET", url: "/api/offices" });
    expect(res.statusCode).toBe(401);
  });
});

describe("/maps/:officeId/:filename serving", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let cookie: string;
  let officeId: number;
  let tmjFilename: string;
  let pngFilename: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-maps-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    cookie = await loginAdmin(server, verifier);

    const m = buildMultipart([
      { name: "name", value: "HQ" },
      { name: "tmj", filename: "a.tmj", contentType: "application/json", data: Buffer.from(makeTmj()) },
      { name: "tilesets", filename: "office_tiles.png", contentType: "image/png", data: makePng(64, 64) },
    ]);
    const create = await server.app.inject({
      method: "POST",
      url: "/api/offices",
      headers: { ...m.headers, cookie },
      payload: m.body,
    });
    const data = create.json<{
      office: { id: number; tmj_filename: string; tilesets: Array<{ filename: string }> };
    }>();
    officeId = data.office.id;
    tmjFilename = data.office.tmj_filename;
    pngFilename = data.office.tilesets[0]!.filename;
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("sirve el .tmj con application/json + cabeceras inmutables + nosniff", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: `/maps/${officeId}/${tmjFilename}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sirve el PNG con image/png", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: `/maps/${officeId}/${pngFilename}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
  });

  it("rechaza path traversal con 400", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: `/maps/${officeId}/..%2F..%2Fetc%2Fpasswd`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("rechaza extensión inválida con 400", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: `/maps/${officeId}/foo.exe`,
    });
    expect(res.statusCode).toBe(400);
  });
});
