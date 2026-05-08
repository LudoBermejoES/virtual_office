import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectImageType,
  isValidAvatarFilename,
  resolveAvatarPath,
  writeAvatarFile,
  deleteAvatarFile,
} from "../../../src/infra/storage/avatars.js";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "ascii"),
]);

describe("avatars storage — detectImageType", () => {
  it("detecta PNG por magic bytes", () => {
    expect(detectImageType(PNG_HEADER)).toBe("png");
  });
  it("detecta JPEG por magic bytes FF D8 FF", () => {
    expect(detectImageType(JPEG_HEADER)).toBe("jpg");
  });
  it("detecta WebP por RIFF/WEBP", () => {
    expect(detectImageType(WEBP_HEADER)).toBe("webp");
  });
  it("devuelve null para basura", () => {
    expect(detectImageType(Buffer.from("not an image"))).toBe(null);
  });
  it("devuelve null para buffer demasiado corto", () => {
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBe(null);
  });
});

describe("avatars storage — isValidAvatarFilename", () => {
  it("acepta formato canónico", () => {
    expect(isValidAvatarFilename("42_a1b2c3d4.png")).toBe(true);
    expect(isValidAvatarFilename("1_aaaaaaaa.webp")).toBe(true);
    expect(isValidAvatarFilename("999_ffffffff.jpg")).toBe(true);
  });
  it("rechaza path traversal y formatos malos", () => {
    expect(isValidAvatarFilename("../etc/passwd")).toBe(false);
    expect(isValidAvatarFilename("42.png")).toBe(false);
    expect(isValidAvatarFilename("42_xx.gif")).toBe(false);
    expect(isValidAvatarFilename("42_AAAAAAAA.png")).toBe(false); // hex en minúscula
    expect(isValidAvatarFilename("42_a1b2c3d4.png/foo")).toBe(false);
  });
});

describe("avatars storage — resolveAvatarPath", () => {
  it("devuelve abs path para filename válido", () => {
    expect(resolveAvatarPath("/tmp/avatars", "42_aabbccdd.png")).toBe("/tmp/avatars/42_aabbccdd.png");
  });
  it("devuelve null para filename inválido", () => {
    expect(resolveAvatarPath("/tmp/avatars", "../etc/passwd")).toBe(null);
  });
});

describe("avatars storage — writeAvatarFile / deleteAvatarFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vo-avatars-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("escribe en AVATARS_DIR con filename <userId>_<hash8>.<ext>", () => {
    const r = writeAvatarFile(dir, 42, PNG_HEADER, "png");
    expect(r.filename).toMatch(/^42_[a-f0-9]{8}\.png$/);
    expect(r.publicUrl).toBe(`/avatars/${r.filename}`);
    expect(existsSync(r.absPath)).toBe(true);
    expect(readFileSync(r.absPath)).toEqual(PNG_HEADER);
  });

  it("dos llamadas seguidas producen filenames distintos", () => {
    const a = writeAvatarFile(dir, 42, PNG_HEADER, "png");
    const b = writeAvatarFile(dir, 42, PNG_HEADER, "png");
    expect(a.filename).not.toBe(b.filename);
  });

  it("deleteAvatarFile borra solo si el path encaja la regex", () => {
    const fake = join(dir, "42_aabbccdd.png");
    writeFileSync(fake, "x");
    expect(deleteAvatarFile(dir, "/avatars/42_aabbccdd.png")).toBe(true);
    expect(existsSync(fake)).toBe(false);
  });

  it("deleteAvatarFile silencioso con ENOENT", () => {
    expect(deleteAvatarFile(dir, "/avatars/42_aabbccdd.png")).toBe(false);
  });

  it("deleteAvatarFile rechaza URLs de Google", () => {
    expect(deleteAvatarFile(dir, "https://lh3.googleusercontent.com/foo")).toBe(false);
  });

  it("deleteAvatarFile rechaza filenames con path traversal", () => {
    expect(deleteAvatarFile(dir, "/avatars/../etc/passwd")).toBe(false);
  });
});
