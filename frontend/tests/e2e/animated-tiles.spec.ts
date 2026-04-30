/**
 * E2E: tile animado — el array de animaciones se persiste y se devuelve en GET /api/offices/:id.
 * Verifica el Scenario: "Tile con animación de 4 frames" a nivel de API HTTP.
 */
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

async function getAdminCookie(): Promise<string> {
  const res = await fetch(`${BACKEND}/api/test/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "anim-admin@e2e.internal", role: "admin" }),
  });
  if (!res.ok) throw new Error(`getAdminCookie failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = /^([^;]+)/.exec(setCookie);
  return match?.[1] ?? "";
}

function makePng64x64(): Buffer {
  const zlib = require("node:zlib") as typeof import("node:zlib");
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  function crc32(buf: Buffer): number {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (const byte of buf) crc = (table[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crcBuf]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(64, 0);
  ihdr.writeUInt32BE(64, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const rawRow = Buffer.alloc(64 * 3 + 1);
  const raw = Buffer.concat(Array.from({ length: 64 }, () => rawRow));
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function makeTmjWithAnimation(): string {
  return JSON.stringify({
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    width: 20,
    height: 15,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: "office_tiles",
        image: "office_tiles.png",
        imagewidth: 64,
        imageheight: 64,
        tilewidth: 32,
        tileheight: 32,
        tiles: [
          {
            id: 0,
            animation: [
              { tileid: 0, duration: 200 },
              { tileid: 1, duration: 200 },
              { tileid: 2, duration: 200 },
              { tileid: 3, duration: 200 },
            ],
          },
        ],
      },
    ],
    layers: [
      {
        type: "tilelayer",
        name: "ground",
        width: 20,
        height: 15,
        data: Array(20 * 15).fill(0),
        encoding: "csv",
      },
    ],
  });
}

test("mapa con tile animado de 4 frames: GET devuelve animations con los 4 frames a 200 ms", async ({
  request,
}) => {
  const adminCookie = await getAdminCookie();

  const uploadRes = await request.post(`${BACKEND}/api/offices`, {
    headers: { cookie: adminCookie },
    multipart: {
      name: "anim-test-office",
      tmj: {
        name: "map.tmj",
        mimeType: "application/json",
        buffer: Buffer.from(makeTmjWithAnimation()),
      },
      tilesets: {
        name: "office_tiles.png",
        mimeType: "image/png",
        buffer: makePng64x64(),
      },
    },
  });
  expect(uploadRes.status()).toBe(201);
  const uploadData = await uploadRes.json<{ office: { id: number } }>();
  const officeId = uploadData.office.id;

  const getRes = await request.get(`${BACKEND}/api/offices/${officeId}`, {
    headers: { cookie: adminCookie },
  });
  expect(getRes.status()).toBe(200);
  const data = await getRes.json<{
    tilesets: Array<{ ordinal: number; animations: Array<{ tileId: number; frames: unknown[] }> }>;
  }>();

  const tileset = data.tilesets[0];
  expect(tileset).toBeDefined();
  expect(tileset!.animations).toHaveLength(1);
  const anim = tileset!.animations[0]!;
  expect(anim.tileId).toBe(0);
  expect(anim.frames).toHaveLength(4);
  for (const frame of anim.frames as Array<{ tileid: number; duration: number }>) {
    expect(frame.duration).toBe(200);
  }
});

test("mapa sin animaciones devuelve animations vacío en cada tileset", async ({ request }) => {
  const adminCookie = await getAdminCookie();

  const tmj = JSON.stringify({
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    width: 10,
    height: 10,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: "tiles",
        image: "tiles.png",
        imagewidth: 64,
        imageheight: 64,
        tilewidth: 32,
        tileheight: 32,
      },
    ],
    layers: [
      {
        type: "tilelayer",
        name: "ground",
        width: 10,
        height: 10,
        data: Array(100).fill(0),
        encoding: "csv",
      },
    ],
  });

  const uploadRes = await request.post(`${BACKEND}/api/offices`, {
    headers: { cookie: adminCookie },
    multipart: {
      name: "no-anim-office",
      tmj: { name: "map.tmj", mimeType: "application/json", buffer: Buffer.from(tmj) },
      tilesets: { name: "tiles.png", mimeType: "image/png", buffer: makePng64x64() },
    },
  });
  expect(uploadRes.status()).toBe(201);
  const uploadData = await uploadRes.json<{ office: { id: number } }>();

  const getRes = await request.get(`${BACKEND}/api/offices/${uploadData.office.id}`, {
    headers: { cookie: adminCookie },
  });
  expect(getRes.status()).toBe(200);
  const data = await getRes.json<{ tilesets: Array<{ animations: unknown[] }> }>();
  expect(data.tilesets[0]!.animations).toEqual([]);
});
