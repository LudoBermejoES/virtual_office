import { createRequire } from "node:module";
import type { APIRequestContext } from "@playwright/test";
import type { TestDesk, TestOffice } from "./types.js";

const require = createRequire(import.meta.url);

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

function makePng(): Buffer {
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
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(64, 0);
  ihdr.writeUInt32BE(64, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const rawRow = Buffer.alloc(64 * 3 + 1);
  const raw = Buffer.concat(Array.from({ length: 64 }, () => rawRow));
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeMinimalTmj(): string {
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

export async function setupTestOffice(
  request: APIRequestContext,
  deskDefs: Array<{ label: string; x: number; y: number }> = [
    { label: "A1", x: 160, y: 110 },
    { label: "A2", x: 240, y: 110 },
  ],
): Promise<TestOffice> {
  const tmjBuffer = Buffer.from(makeMinimalTmj());
  const pngBuffer = makePng();

  const res = await request.post(`${BACKEND}/api/offices`, {
    multipart: {
      name: "test-office",
      tmj: { name: "map.tmj", mimeType: "application/json", buffer: tmjBuffer },
      tilesets: { name: "office_tiles.png", mimeType: "image/png", buffer: pngBuffer },
    },
  });

  if (!res.ok()) {
    throw new Error(`setupTestOffice: failed to create office — ${res.status()} ${await res.text()}`);
  }

  const data = await res.json<{ office: { id: number } }>();
  const officeId = data.office.id;

  const desks: TestDesk[] = [];
  for (const def of deskDefs) {
    const deskRes = await request.post(`${BACKEND}/api/offices/${officeId}/desks`, {
      data: def,
    });
    if (!deskRes.ok()) {
      throw new Error(`setupTestOffice: failed to create desk ${def.label} — ${deskRes.status()}`);
    }
    const deskData = await deskRes.json<{ desk: { id: number; label: string; x: number; y: number } }>();
    desks.push(deskData.desk);
  }

  return { officeId, desks };
}
