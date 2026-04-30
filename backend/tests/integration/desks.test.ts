import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { makeTmj } from "../support/tiled-fixtures.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string, overrides: Record<string, string> = {}) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
    MAX_DESKS_PER_OFFICE: "200",
    ...overrides,
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

/**
 * Crea una oficina seedeada directamente en DB + filesystem para evitar el flujo multipart.
 * Devuelve { officeId, mapsDir }.
 */
function seedOffice(
  db: TestDb["db"],
  mapsDir: string,
  opts: { tmjContent?: string; cells_x?: number; cells_y?: number } = {},
): number {
  const cells_x = opts.cells_x ?? 25;
  const cells_y = opts.cells_y ?? 19;
  const tile = 32;
  const tmjFilename = "map_seed12345678.tmj";

  const result = db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", tmjFilename, tile, tile, cells_x, cells_y, cells_x * tile, cells_y * tile);
  const officeId = Number(result.lastInsertRowid);

  const dir = join(mapsDir, String(officeId));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, tmjFilename),
    opts.tmjContent ?? makeTmj({ width: cells_x, height: cells_y, tilewidth: tile, tileheight: tile }),
  );
  return officeId;
}

describe("desks routes", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let cookie: string;
  let officeId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-desks-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
    cookie = await loginAdmin(server, verifier);
    officeId = seedOffice(testDb.db, mapsDir);
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("POST /api/offices/:id/desks crea desk con source=manual (201)", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ desk: { label: string; x: number; y: number; source: string } }>();
    expect(body.desk).toMatchObject({ label: "A1", x: 160, y: 110, source: "manual" });
  });

  it("label duplicado en la misma oficina → 409 label_taken", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 300, y: 300 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ reason: string }>().reason).toBe("label_taken");
  });

  it("coords fuera del mapa → 422 out_of_bounds", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "OUT", x: 9999, y: 9999 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("out_of_bounds");
  });

  it("Chebyshev=10 de otro existente → 422 too_close_to_existing", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A2", x: 170, y: 120 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("too_close_to_existing");
  });

  it("oficina llena → 422 office_full", async () => {
    const env = makeTestEnv(mapsDir, { MAX_DESKS_PER_OFFICE: "2" });
    await server.teardown();
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env,
    });
    cookie = await loginAdmin(server, verifier);

    await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 100, y: 100 },
    });
    await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A2", x: 200, y: 200 },
    });
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A3", x: 300, y: 300 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ reason: string }>().reason).toBe("office_full");
  });

  it("PATCH /api/desks/:id mueve coords con validación", async () => {
    const create = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    const deskId = create.json<{ desk: { id: number } }>().desk.id;

    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/desks/${deskId}`,
      headers: { cookie },
      body: { x: 220, y: 110 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ desk: { x: number; y: number } }>().desk).toMatchObject({
      x: 220,
      y: 110,
    });
  });

  it("PATCH puede cambiar solo label", async () => {
    const create = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    const deskId = create.json<{ desk: { id: number } }>().desk.id;

    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/desks/${deskId}`,
      headers: { cookie },
      body: { label: "DIRECCION" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ desk: { label: string } }>().desk.label).toBe("DIRECCION");
  });

  it("DELETE /api/desks/:id → 204", async () => {
    const create = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    const deskId = create.json<{ desk: { id: number } }>().desk.id;

    const del = await server.app.inject({
      method: "DELETE",
      url: `/api/desks/${deskId}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(204);
  });

  it("Member intenta cualquiera → 403", async () => {
    const memberCookie = await loginMember(server, verifier);
    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie: memberCookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /api/offices/:id incluye desks con id, label, x, y, source", async () => {
    await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A1", x: 160, y: 110 },
    });
    const res = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ desks: Array<{ label: string; source: string }> }>();
    expect(body.desks).toHaveLength(1);
    expect(body.desks[0]).toMatchObject({ label: "A1", source: "manual" });
  });
});

describe("desks import-from-tiled", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let cookie: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-desks-import-"));
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

  function makeTmjWithDesksLayer(points: Array<{ name?: string; x: number; y: number }>): string {
    const tmj = JSON.parse(makeTmj()) as Record<string, unknown>;
    const layers = tmj["layers"] as unknown[];
    layers.push({
      type: "objectgroup",
      name: "desks",
      objects: points.map((p, idx) => ({
        id: idx + 1,
        ...(p.name !== undefined ? { name: p.name } : {}),
        x: p.x,
        y: p.y,
        point: true,
      })),
    });
    return JSON.stringify(tmj);
  }

  it("seed con tmj que incluye object layer 'desks' con 3 points → import-from-tiled crea 3 desks source=tiled", async () => {
    const tmj = makeTmjWithDesksLayer([
      { name: "A1", x: 100, y: 100 },
      { name: "A2", x: 200, y: 200 },
      { name: "A3", x: 300, y: 300 },
    ]);
    const officeId = seedOffice(testDb.db, mapsDir, { tmjContent: tmj });

    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks/import-from-tiled`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ imported: number; warnings: unknown[] }>();
    expect(body.imported).toBe(3);
    expect(body.warnings).toEqual([]);

    const detail = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}`,
      headers: { cookie },
    });
    const desks = detail.json<{ desks: Array<{ source: string; label: string }> }>().desks;
    expect(desks).toHaveLength(3);
    expect(desks.every((d) => d.source === "tiled")).toBe(true);
  });

  it("warning si un point queda fuera de bounds; el resto se importa", async () => {
    const tmj = makeTmjWithDesksLayer([
      { name: "A1", x: 100, y: 100 },
      { name: "OUT", x: 99999, y: 99999 },
    ]);
    const officeId = seedOffice(testDb.db, mapsDir, { tmjContent: tmj });

    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks/import-from-tiled`,
      headers: { cookie },
    });
    const body = res.json<{ imported: number; warnings: Array<{ reason: string }> }>();
    expect(body.imported).toBe(1);
    expect(body.warnings.some((w) => w.reason === "out_of_bounds")).toBe(true);
  });

  it("re-importación añade solo los nuevos del layer", async () => {
    const tmjA = makeTmjWithDesksLayer([
      { name: "A1", x: 100, y: 100 },
      { name: "A2", x: 200, y: 200 },
    ]);
    const officeId = seedOffice(testDb.db, mapsDir, { tmjContent: tmjA });

    await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks/import-from-tiled`,
      headers: { cookie },
    });

    const tmjB = makeTmjWithDesksLayer([
      { name: "A1", x: 100, y: 100 },
      { name: "A2", x: 200, y: 200 },
      { name: "A3", x: 300, y: 300 },
    ]);
    writeFileSync(join(mapsDir, String(officeId), "map_seed12345678.tmj"), tmjB);

    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks/import-from-tiled`,
      headers: { cookie },
    });
    expect(res.json<{ imported: number }>().imported).toBe(1);
  });

  it("re-importación con label colisionando con manual → warning label_taken_by_manual", async () => {
    const tmj = makeTmjWithDesksLayer([{ name: "A4", x: 100, y: 100 }]);
    const officeId = seedOffice(testDb.db, mapsDir, { tmjContent: tmj });

    await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks`,
      headers: { cookie },
      body: { label: "A4", x: 400, y: 400 },
    });

    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks/import-from-tiled`,
      headers: { cookie },
    });
    const body = res.json<{ imported: number; warnings: Array<{ reason: string }> }>();
    expect(body.imported).toBe(0);
    expect(body.warnings.some((w) => w.reason === "label_taken_by_manual")).toBe(true);
  });

  it("Member intenta import-from-tiled → 403", async () => {
    const tmj = makeTmjWithDesksLayer([{ name: "A1", x: 100, y: 100 }]);
    const officeId = seedOffice(testDb.db, mapsDir, { tmjContent: tmj });
    const memberCookie = await loginMember(server, verifier);

    const res = await server.app.inject({
      method: "POST",
      url: `/api/offices/${officeId}/desks/import-from-tiled`,
      headers: { cookie: memberCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
