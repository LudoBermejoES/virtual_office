/**
 * Helpers para construir fixtures Tiled válidos (.tmj + tilesets) en memoria.
 */
import { deflateSync } from "node:zlib";

export interface TiledFixtureOptions {
  version?: string;
  orientation?: string;
  width?: number;
  height?: number;
  tilewidth?: number;
  tileheight?: number;
  tilesets?: Array<{ image: string; imagewidth?: number; imageheight?: number }>;
  layerCompression?: string;
  layerEncoding?: "csv" | "base64";
  externalTilesetSource?: string;
}

export function makeTmj(opts: TiledFixtureOptions = {}): string {
  const tilesets = (opts.tilesets ?? [{ image: "office_tiles.png" }]).map((t, idx) => {
    const base = {
      firstgid: idx * 100 + 1,
      name: t.image.replace(/\.[^.]+$/, ""),
      image: t.image,
      imagewidth: t.imagewidth ?? 256,
      imageheight: t.imageheight ?? 256,
      tilewidth: opts.tilewidth ?? 32,
      tileheight: opts.tileheight ?? 32,
    };
    return opts.externalTilesetSource ? { ...base, source: opts.externalTilesetSource } : base;
  });

  const layer: Record<string, unknown> = {
    type: "tilelayer",
    name: "ground",
    width: opts.width ?? 20,
    height: opts.height ?? 15,
    data: [0, 1, 2],
    encoding: opts.layerEncoding ?? "csv",
  };
  if (opts.layerCompression) layer["compression"] = opts.layerCompression;

  const map = {
    type: "map",
    version: opts.version ?? "1.10",
    orientation: opts.orientation ?? "orthogonal",
    width: opts.width ?? 20,
    height: opts.height ?? 15,
    tilewidth: opts.tilewidth ?? 32,
    tileheight: opts.tileheight ?? 32,
    infinite: false,
    tilesets,
    layers: [layer],
  };
  return JSON.stringify(map);
}

/**
 * Genera un PNG mínimo de NxN del color sólido pasado.
 * Usa el formato PNG IHDR + IDAT + IEND minimal con CRC computado.
 * Para tests, generamos PNGs pequeños pero válidos.
 */
export function makePng(width: number, height: number): Buffer {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type (RGB)
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  // IDAT con datos comprimidos zlib (línea de píxeles transparente)
  const zlib = require("node:zlib") as typeof import("node:zlib");
  const rowBytes = width * 3;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function crc32(buf: Buffer): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = (table[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}
