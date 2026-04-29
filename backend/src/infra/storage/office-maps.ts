import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export interface FilePart {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface SavedBundle {
  tmjFilename: string;
  tilesets: Array<{
    ordinal: number;
    image_name: string;
    filename: string;
    mime_type: "image/png" | "image/webp";
  }>;
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function computeTmjFilename(buf: Buffer): string {
  return `map_${sha256Hex(buf).slice(0, 12)}.tmj`;
}

export function computeTilesetFilename(ordinal: number, sha: string, ext: "png" | "webp"): string {
  return `tile_${ordinal}_${sha.slice(0, 12)}.${ext}`;
}

const FILENAME_REGEX = /^(map|tile)_[a-zA-Z0-9_.-]+\.(tmj|png|webp)$/;

export function isValidFilename(filename: string): boolean {
  return FILENAME_REGEX.test(filename);
}

export function saveBundle(opts: {
  baseDir: string;
  officeId: number;
  tmj: { buffer: Buffer; image_filenames: string[] };
  tilesets: Array<{ buffer: Buffer; image_name: string; mime_type: "image/png" | "image/webp" }>;
}): SavedBundle {
  const dir = join(opts.baseDir, String(opts.officeId));
  mkdirSync(dir, { recursive: true });

  const tmjFilename = computeTmjFilename(opts.tmj.buffer);
  writeFileSync(join(dir, tmjFilename), opts.tmj.buffer);

  const tilesets: SavedBundle["tilesets"] = [];
  for (const t of opts.tilesets) {
    const ordinal = opts.tmj.image_filenames.indexOf(t.image_name);
    if (ordinal < 0) {
      throw new Error(`tileset ${t.image_name} no aparece en el tmj`);
    }
    const ext = t.mime_type === "image/png" ? "png" : "webp";
    const sha = sha256Hex(t.buffer);
    const filename = computeTilesetFilename(ordinal, sha, ext);
    writeFileSync(join(dir, filename), t.buffer);
    tilesets.push({ ordinal, image_name: t.image_name, filename, mime_type: t.mime_type });
  }
  tilesets.sort((a, b) => a.ordinal - b.ordinal);
  return { tmjFilename, tilesets };
}

export function serveSafe(
  baseDir: string,
  officeId: number,
  filename: string,
): { ok: true; absPath: string } | { ok: false; reason: "bad_filename" | "not_found" } {
  if (!isValidFilename(filename)) return { ok: false, reason: "bad_filename" };
  if (filename.includes("..") || filename.includes("/") || filename.includes(sep)) {
    return { ok: false, reason: "bad_filename" };
  }
  const dir = resolve(baseDir, String(officeId));
  const abs = resolve(dir, filename);
  if (!abs.startsWith(dir + sep) && abs !== dir) return { ok: false, reason: "bad_filename" };
  if (!existsSync(abs) || !statSync(abs).isFile()) return { ok: false, reason: "not_found" };
  return { ok: true, absPath: abs };
}
