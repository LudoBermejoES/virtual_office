/**
 * Endpoints de avatares custom (change 030).
 *
 *   POST   /api/users/:id/avatar    multipart admin only
 *   DELETE /api/users/:id/avatar    admin only
 *   GET    /avatars/:filename       servidor estático con cache immutable
 */
import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { logger } from "../../config/logger.js";
import { findUserById, setAvatarLocked } from "../../infra/repos/users.js";
import {
  detectImageType,
  isValidAvatarFilename,
  resolveAvatarPath,
  writeAvatarFile,
  deleteAvatarFile,
} from "../../infra/storage/avatars.js";
import { existsSync } from "node:fs";
import type { Env } from "../../config/env.js";

const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);

export async function avatarsRoutes(
  app: FastifyInstance,
  { db, env }: { db: DatabaseSync; env: Env },
): Promise<void> {
  app.post("/api/users/:id/avatar", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const target = findUserById(db, params.data.id);
    if (!target) return reply.status(404).send({ reason: "user_not_found" });

    // Leer multipart: aceptamos exactamente un fichero `file` con
    // image/png|webp|jpeg ≤ MAX_AVATAR_BYTES.
    let contentType: string | null = null;
    let buffer: Buffer | null = null;
    const limit = env.MAX_AVATAR_BYTES;

    try {
      for await (const part of request.parts()) {
        if (part.type !== "file") continue;
        if (part.fieldname !== "file") continue;
        if (!ALLOWED_CONTENT_TYPES.has(part.mimetype)) {
          return reply.status(400).send({ reason: "bad_content_type" });
        }
        contentType = part.mimetype;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > limit) {
            return reply.status(400).send({ reason: "file_too_large" });
          }
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
        break; // sólo procesamos el primero
      }
    } catch (err) {
      // @fastify/multipart lanza si supera limites globales.
      const msg = (err as Error).message ?? "";
      if (msg.includes("FST_REQ_FILE_TOO_LARGE") || msg.includes("file too large")) {
        return reply.status(400).send({ reason: "file_too_large" });
      }
      throw err;
    }

    if (!buffer || !contentType) {
      return reply.status(400).send({ reason: "file_missing" });
    }

    const detected = detectImageType(buffer);
    if (!detected) return reply.status(400).send({ reason: "bad_image" });

    // El content-type declarado debe coincidir con el formato real.
    const ctOk =
      (contentType === "image/png" && detected === "png") ||
      (contentType === "image/webp" && detected === "webp") ||
      (contentType === "image/jpeg" && detected === "jpg");
    if (!ctOk) return reply.status(400).send({ reason: "bad_image" });

    // Borrar avatar custom anterior (best-effort) antes de escribir el nuevo.
    if (target.avatar_url && target.avatar_url.startsWith("/avatars/")) {
      deleteAvatarFile(env.AVATARS_DIR, target.avatar_url);
    }

    const written = writeAvatarFile(env.AVATARS_DIR, target.id, buffer, detected);
    setAvatarLocked(db, target.id, written.publicUrl, 1);

    const fresh = findUserById(db, target.id)!;

    logger.info("auth.avatar.uploaded.byAdmin", {
      adminId: request.user!.id,
      targetUserId: target.id,
      filename: written.filename,
      sizeBytes: buffer.length,
      contentType,
    });

    return reply.status(200).send({
      user: {
        id: fresh.id,
        name: fresh.name,
        email: fresh.email,
        avatar_url: fresh.avatar_url,
        avatar_locked: fresh.avatar_locked,
      },
    });
  });

  app.delete("/api/users/:id/avatar", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const target = findUserById(db, params.data.id);
    if (!target) return reply.status(404).send({ reason: "user_not_found" });

    // Idempotente: si no había override, devolvemos 200 sin tocar nada.
    if (target.avatar_locked !== 1) {
      return reply.status(200).send({
        user: {
          id: target.id,
          name: target.name,
          email: target.email,
          avatar_url: target.avatar_url,
          avatar_locked: target.avatar_locked,
        },
      });
    }

    if (target.avatar_url && target.avatar_url.startsWith("/avatars/")) {
      deleteAvatarFile(env.AVATARS_DIR, target.avatar_url);
    }
    setAvatarLocked(db, target.id, null, 0);
    const fresh = findUserById(db, target.id)!;

    logger.info("auth.avatar.reset.byAdmin", {
      adminId: request.user!.id,
      targetUserId: target.id,
    });

    return reply.status(200).send({
      user: {
        id: fresh.id,
        name: fresh.name,
        email: fresh.email,
        avatar_url: fresh.avatar_url,
        avatar_locked: fresh.avatar_locked,
      },
    });
  });

  // Servidor estático del avatar. No requiere auth (igual patrón que /maps/).
  app.get("/avatars/:filename", async (request, reply) => {
    const params = request.params as { filename: string };
    if (!isValidAvatarFilename(params.filename)) {
      return reply.status(400).send({ reason: "bad_filename" });
    }
    const abs = resolveAvatarPath(env.AVATARS_DIR, params.filename);
    if (!abs || !existsSync(abs)) {
      return reply.status(404).send({ reason: "not_found" });
    }
    const ct = params.filename.endsWith(".png")
      ? "image/png"
      : params.filename.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    reply
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .type(ct);
    return reply.send(createReadStream(abs));
  });
}
