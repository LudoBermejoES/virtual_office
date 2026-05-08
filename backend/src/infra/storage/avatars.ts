/**
 * Storage en disco para avatares custom (change 030).
 *
 * Filenames: `<userId>_<hash8>.<ext>` con `ext` ∈ { png, webp, jpg }. El hash
 * son 8 hex random para evitar colisiones entre re-subidas y permitir cache
 * `immutable` (el hash hace que un avatar nuevo sea URL nueva).
 */
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, basename, isAbsolute, resolve } from "node:path";
import { randomBytes } from "node:crypto";

export type AvatarExt = "png" | "webp" | "jpg";

/**
 * Detecta el formato real de la imagen leyendo los primeros bytes. Devuelve
 * `null` si no encaja con PNG, WebP o JPEG. Esto bloquea ataques tipo
 * "renombrar .exe a .png".
 */
export function detectImageType(buf: Buffer): AvatarExt | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }
  // WebP: bytes 0..3 = "RIFF", bytes 8..11 = "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

const FILENAME_REGEX = /^\d+_[a-f0-9]{8}\.(png|webp|jpg)$/;

/** Valida un filename de avatar. Bloquea path traversal y formatos no soportados. */
export function isValidAvatarFilename(filename: string): boolean {
  return FILENAME_REGEX.test(filename);
}

/**
 * Devuelve el path absoluto del avatar dentro de `avatarsDir`, o null si el
 * filename no es válido o si la resolución cae fuera del directorio.
 */
export function resolveAvatarPath(avatarsDir: string, filename: string): string | null {
  if (!isValidAvatarFilename(filename)) return null;
  const root = resolve(avatarsDir);
  const abs = resolve(root, filename);
  if (!abs.startsWith(root + "/") && abs !== root) return null;
  return abs;
}

export interface WriteAvatarResult {
  filename: string;
  /** Ruta servida públicamente, p.ej. `/avatars/42_aabbccdd.webp`. */
  publicUrl: string;
  absPath: string;
}

/**
 * Escribe el buffer del avatar en disco con un filename derivado del userId
 * + hash random. Crea `avatarsDir` si no existe.
 */
export function writeAvatarFile(
  avatarsDir: string,
  userId: number,
  buf: Buffer,
  ext: AvatarExt,
): WriteAvatarResult {
  mkdirSync(avatarsDir, { recursive: true });
  const hash = randomBytes(4).toString("hex");
  const filename = `${String(userId)}_${hash}.${ext}`;
  const absPath = join(avatarsDir, filename);
  writeFileSync(absPath, buf);
  return {
    filename,
    publicUrl: `/avatars/${filename}`,
    absPath,
  };
}

/**
 * Borra un avatar del disco si su ruta corresponde a un filename válido bajo
 * `avatarsDir`. Best-effort: si no existe, no falla. Devuelve true si hubo
 * algo que borrar.
 *
 * Acepta tanto la URL pública (`/avatars/<filename>`) como un filename pelado.
 * Cualquier ruta que no encaje el formato se ignora silenciosamente (los
 * avatares de Google no pueden borrarse con esto, y eso es lo correcto).
 */
export function deleteAvatarFile(avatarsDir: string, urlOrFilename: string): boolean {
  let filename: string;
  if (urlOrFilename.startsWith("/avatars/")) {
    filename = urlOrFilename.slice("/avatars/".length);
  } else if (!isAbsolute(urlOrFilename) && !urlOrFilename.includes("/")) {
    filename = urlOrFilename;
  } else {
    return false;
  }
  if (!isValidAvatarFilename(filename)) return false;
  const safeName = basename(filename);
  const abs = join(avatarsDir, safeName);
  if (!existsSync(abs)) return false;
  try {
    unlinkSync(abs);
    return true;
  } catch {
    return false;
  }
}
