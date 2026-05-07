import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

function makeTestEnv(mapsDir: string): ReturnType<typeof parseEnv> {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
  });
}

async function login(
  server: TestServer,
  verifier: FakeGoogleVerifier,
  email: string,
  sub: string,
): Promise<string> {
  verifier.setNextPayload({
    sub,
    email,
    hd: "teimas.com",
    name: email,
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

function setupTmj(
  testDb: TestDb,
  mapsDir: string,
  tmjBody: string,
): { officeId: number; expectedHash: string; tmjPath: string } {
  const stmt = testDb.db.prepare(
    `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
     VALUES (?, 'map.tmj', 32, 32, 10, 10, 320, 320)`,
  );
  const r = stmt.run("ofi");
  const officeId = Number(r.lastInsertRowid);
  const dir = join(mapsDir, String(officeId));
  mkdirSync(dir, { recursive: true });
  const tmjPath = join(dir, "map.tmj");
  writeFileSync(tmjPath, tmjBody);
  return {
    officeId,
    expectedHash: createHash("sha256").update(tmjBody).digest("hex"),
    tmjPath,
  };
}

const baseTmj = JSON.stringify({
  width: 10,
  height: 10,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "ground", data: [0, 0, 0] },
    { type: "tilelayer", name: "furniture", data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "desks",
      objects: [{ id: 1, x: 0, y: 0, width: 48, height: 48 }],
    },
    {
      type: "objectgroup",
      name: "sprites_floor",
      objects: [
        {
          id: 2,
          point: true,
          x: 50,
          y: 50,
          properties: [{ name: "sprite", type: "string", value: "cat" }],
        },
      ],
    },
  ],
});

const newOverlay = {
  name: "sprites_overlay",
  type: "objectgroup",
  objects: [
    {
      id: 100,
      point: true,
      x: 200,
      y: 200,
      properties: [{ name: "sprite", type: "string", value: "cat" }],
    },
  ],
};

const SYSTEM_LAYERS = ["ground", "furniture", "desks"];

function makeBody(opts: {
  expectedHash: string;
  layerOrder: string[];
  spritesLayers?: Record<string, unknown>;
  layersVisibility?: Record<string, boolean>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    expected_hash: opts.expectedHash,
    layer_order: opts.layerOrder,
    sprites_layers: opts.spritesLayers ?? {},
  };
  if (opts.layersVisibility) body["layers_visibility"] = opts.layersVisibility;
  return body;
}

describe("PATCH /api/offices/:id/map/sprites-layers", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-sprites-layers-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir),
    });
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
  });

  it("400 cuando el body no cumple el schema (capa con nombre inválido)", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: [...SYSTEM_LAYERS, "decoration"],
        spritesLayers: { decoration: { name: "decoration", type: "objectgroup", objects: [] } },
      }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("401 sin sesión", async () => {
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      payload: makeBody({ expectedHash, layerOrder: SYSTEM_LAYERS }),
    });
    expect(res.statusCode).toBe(401);
  });

  it("403 si autenticado pero no admin", async () => {
    const cookie = await login(server, verifier, "bob@teimas.com", "member-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({ expectedHash, layerOrder: SYSTEM_LAYERS }),
    });
    expect(res.statusCode).toBe(403);
  });

  it("409 si expected_hash no coincide; el body incluye current_hash", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const wrongHash = "0".repeat(64);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({ expectedHash: wrongHash, layerOrder: SYSTEM_LAYERS }),
    });
    expect(res.statusCode).toBe(409);
    const body = res.json<{ error: string; current_hash: string }>();
    expect(body.error).toBe("tmj_hash_mismatch");
    expect(body.current_hash).toBe(expectedHash);
  });

  it("422 si algún sprite id no está en SPRITE_MANIFEST", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const dragonLayer = {
      ...newOverlay,
      objects: [
        {
          ...newOverlay.objects[0]!,
          properties: [{ name: "sprite", type: "string", value: "dragon" }],
        },
      ],
    };
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: [...SYSTEM_LAYERS, "sprites_overlay"],
        spritesLayers: { sprites_overlay: dragonLayer },
      }),
    });
    expect(res.statusCode).toBe(422);
    const body = res.json<{ error: string; id: string }>();
    expect(body.error).toBe("unknown_sprite_id");
    expect(body.id).toBe("dragon");
  });

  it("400 layer_order_missing_system_layer si falta una capa del sistema", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: ["ground", "furniture"], // falta desks
      }),
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string; missing: string[] }>();
    expect(body.error).toBe("layer_order_missing_system_layer");
    expect(body.missing).toContain("desks");
  });

  it("400 layer_order_unknown_name si layer_order trae un nombre desconocido", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: [...SYSTEM_LAYERS, "foo"],
      }),
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string; unknown: string[] }>();
    expect(body.error).toBe("layer_order_unknown_name");
    expect(body.unknown).toContain("foo");
  });

  it("400 visibility_unknown_layer si menciona una capa inexistente", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: SYSTEM_LAYERS,
        layersVisibility: { foo: false },
      }),
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string; unknown: string[] }>();
    expect(body.error).toBe("visibility_unknown_layer");
    expect(body.unknown).toContain("foo");
  });

  it("200 reordena e intercala una capa sprites_* entre tilelayers, preservando contenido del sistema", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash, tmjPath } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: ["ground", "sprites_overlay", "furniture", "desks"],
        spritesLayers: { sprites_overlay: newOverlay },
      }),
    });
    expect(res.statusCode).toBe(200);

    const written = JSON.parse(readFileSync(tmjPath, "utf-8")) as {
      layers: Array<Record<string, unknown>>;
    };
    expect(written.layers.map((l) => l["name"])).toEqual([
      "ground",
      "sprites_overlay",
      "furniture",
      "desks",
    ]);
    // Tilelayers preservan su data
    expect(written.layers[0]!["data"]).toEqual([0, 0, 0]);
    expect(written.layers[2]!["data"]).toEqual([1, 1, 1]);
    // desks preserva sus objetos
    expect(written.layers[3]!["objects"]).toEqual([
      { id: 1, x: 0, y: 0, width: 48, height: 48 },
    ]);
  });

  it("200 borra capas sprites_* del original cuando no se incluyen", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash, tmjPath } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: SYSTEM_LAYERS,
        spritesLayers: {},
      }),
    });
    expect(res.statusCode).toBe(200);
    const written = JSON.parse(readFileSync(tmjPath, "utf-8")) as { layers: Array<{ name: string }> };
    expect(written.layers.map((l) => l.name)).toEqual(SYSTEM_LAYERS);
  });

  it("200 toggle de visibilidad escribe visible=false en la capa del TMJ y no toca el resto", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash, tmjPath } = setupTmj(testDb, mapsDir, baseTmj);
    const res = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: SYSTEM_LAYERS,
        layersVisibility: { furniture: false },
      }),
    });
    expect(res.statusCode).toBe(200);
    const written = JSON.parse(readFileSync(tmjPath, "utf-8")) as {
      layers: Array<Record<string, unknown>>;
    };
    const furniture = written.layers.find((l) => l["name"] === "furniture")!;
    expect(furniture["visible"]).toBe(false);
    expect(furniture["data"]).toEqual([1, 1, 1]);
    const ground = written.layers.find((l) => l["name"] === "ground")!;
    expect("visible" in ground).toBe(false);
  });

  it("tras PATCH, GET .../map/raw devuelve el nuevo hash y el TMJ actualizado", async () => {
    const cookie = await login(server, verifier, "alice@teimas.com", "admin-sub");
    const { officeId, expectedHash } = setupTmj(testDb, mapsDir, baseTmj);
    const patchRes = await server.app.inject({
      method: "PATCH",
      url: `/api/offices/${officeId}/map/sprites-layers`,
      headers: { cookie },
      payload: makeBody({
        expectedHash,
        layerOrder: [...SYSTEM_LAYERS, "sprites_overlay"],
        spritesLayers: { sprites_overlay: newOverlay },
      }),
    });
    expect(patchRes.statusCode).toBe(200);
    const newHash = patchRes.json<{ tmj_hash: string }>().tmj_hash;

    const getRes = await server.app.inject({
      method: "GET",
      url: `/api/offices/${officeId}/map/raw`,
      headers: { cookie },
    });
    expect(getRes.statusCode).toBe(200);
    const body = getRes.json<{
      tmj: { layers: Array<{ name: string }> };
      tmj_hash: string;
    }>();
    expect(body.tmj_hash).toBe(newHash);
    expect(body.tmj.layers.map((l) => l.name)).toEqual([
      "ground",
      "furniture",
      "desks",
      "sprites_overlay",
    ]);
  });
});
