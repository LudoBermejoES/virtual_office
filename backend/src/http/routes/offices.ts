import type { FastifyInstance, FastifyRequest } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { parseTiled, checkTilesetMatch } from "../../domain/tiled.js";
import { saveBundle, serveSafe } from "../../infra/storage/office-maps.js";
import * as officesRepo from "../../infra/repos/offices.js";
import * as desksRepo from "../../infra/repos/desks.js";
import * as bookingsRepo from "../../infra/repos/bookings.js";
import * as fixedRepo from "../../infra/repos/fixed-assignments.js";
import * as featuresRepo from "../../infra/repos/features.js";
import * as npcsRepo from "../../infra/repos/npcs.js";
import { officeRoom } from "../../infra/ws/hub.js";
import type { WsHub } from "../../infra/ws/hub.js";
import { importDesksFromTiled } from "./desks.js";
import { parseTiledFeatures } from "../../services/tiled-features.parser.js";
import { parseTiledAnimationsAndNpcs } from "../../services/tiled-animations.parser.js";
import { parseIsoDate, todayIso } from "../../domain/bookings.js";
import { canAdminOffice } from "../../services/auth.service.js";
import { logger } from "../../config/logger.js";
import type { Env } from "../../config/env.js";

interface MultipartParts {
  name?: string;
  tmj?: { filename: string; buffer: Buffer };
  tilesets: Array<{ filename: string; buffer: Buffer }>;
}

const TMJ_MAX = 1_048_576;
const TILESET_MAX = 2_097_152;
const TOTAL_MAX = 10_485_760;

async function readMultipart(
  request: FastifyRequest,
): Promise<{ ok: true; parts: MultipartParts } | { ok: false; status: number; reason: string }> {
  const parts: MultipartParts = { tilesets: [] };
  let totalBytes = 0;

  for await (const part of request.parts()) {
    if (part.type === "field" && part.fieldname === "name") {
      parts.name = String(part.value).slice(0, 80);
      continue;
    }
    if (part.type !== "file") continue;

    const chunks: Buffer[] = [];
    let size = 0;
    const limit = part.fieldname === "tmj" ? TMJ_MAX : TILESET_MAX;
    for await (const chunk of part.file) {
      size += chunk.length;
      totalBytes += chunk.length;
      if (size > limit || totalBytes > TOTAL_MAX) {
        return { ok: false, status: 413, reason: "payload_too_large" };
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (part.fieldname === "tmj") {
      parts.tmj = { filename: part.filename, buffer };
    } else if (part.fieldname === "tilesets") {
      parts.tilesets.push({ filename: part.filename, buffer });
    }
  }

  return { ok: true, parts };
}

interface ProcessedBundle {
  map: ReturnType<typeof parseTiled> & { ok: true };
  tilesetParts: Array<{
    image_name: string;
    buffer: Buffer;
    mime_type: "image/png" | "image/webp";
  }>;
}

async function validateBundle(
  parts: MultipartParts,
): Promise<
  | { ok: true; data: ProcessedBundle }
  | { ok: false; status: number; reason: string; details?: string[] }
> {
  if (!parts.tmj) return { ok: false, status: 400, reason: "tmj_missing" };
  if (parts.tilesets.length === 0) {
    return {
      ok: false,
      status: 422,
      reason: "tileset_mismatch",
      details: ["missing: at least one tileset"],
    };
  }

  const text = parts.tmj.buffer.toString("utf-8");
  const parsed = parseTiled(text);
  if (!parsed.ok) return { ok: false, status: 422, reason: parsed.reason };

  const filenames = parts.tilesets.map((t) => t.filename);
  const match = checkTilesetMatch(parsed.map, filenames);
  if (!match.ok) {
    return { ok: false, status: 422, reason: match.reason, details: match.details };
  }

  const tilesetParts: ProcessedBundle["tilesetParts"] = [];
  for (const part of parts.tilesets) {
    const ft = await fileTypeFromBuffer(part.buffer);
    if (!ft || (ft.mime !== "image/png" && ft.mime !== "image/webp")) {
      return { ok: false, status: 415, reason: "unsupported_media_type" };
    }
    let dims: { width?: number; height?: number };
    try {
      dims = imageSize(part.buffer);
    } catch {
      return { ok: false, status: 422, reason: "tileset_too_small" };
    }
    if (
      !dims.width ||
      !dims.height ||
      dims.width < parsed.map.tilewidth ||
      dims.height < parsed.map.tileheight
    ) {
      return { ok: false, status: 422, reason: "tileset_too_small" };
    }
    tilesetParts.push({
      image_name: part.filename,
      buffer: part.buffer,
      mime_type: ft.mime,
    });
  }

  return { ok: true, data: { map: parsed, tilesetParts } };
}

export async function officesRoutes(
  app: FastifyInstance,
  { db, env, hub }: { db: DatabaseSync; env: Env; hub: WsHub },
): Promise<void> {
  app.post("/api/offices", { preHandler: app.requireAdmin }, async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.status(400).send({ reason: "expected_multipart" });
    }

    const partsResult = await readMultipart(request);
    if (!partsResult.ok)
      return reply.status(partsResult.status).send({ reason: partsResult.reason });

    const validation = await validateBundle(partsResult.parts);
    if (!validation.ok) {
      return reply
        .status(validation.status)
        .send({ reason: validation.reason, details: validation.details });
    }

    const { map, tilesetParts } = validation.data;
    const name = partsResult.parts.name ?? "Office";

    const tile_width = map.map.tilewidth;
    const tile_height = map.map.tileheight;
    const cells_x = map.map.width;
    const cells_y = map.map.height;

    const office = officesRepo.createOffice(db, {
      name,
      tmj_filename: "pending",
      tile_width,
      tile_height,
      cells_x,
      cells_y,
      map_width: cells_x * tile_width,
      map_height: cells_y * tile_height,
    });

    const saved = saveBundle({
      baseDir: env.OFFICE_MAPS_DIR,
      officeId: office.id,
      tmj: {
        buffer: partsResult.parts.tmj!.buffer,
        image_filenames: map.map.tilesets.map((t) => t.image),
      },
      tilesets: tilesetParts,
    });

    officesRepo.updateOfficeBundle(db, office.id, {
      tmj_filename: saved.tmjFilename,
      tile_width,
      tile_height,
      cells_x,
      cells_y,
      map_width: cells_x * tile_width,
      map_height: cells_y * tile_height,
    });
    const importResult = importDesksFromTiled(db, office.id, env.OFFICE_MAPS_DIR);

    const tmjJson = JSON.parse(partsResult.parts.tmj!.buffer.toString("utf-8")) as Record<
      string,
      unknown
    >;

    const animResult = parseTiledAnimationsAndNpcs(tmjJson);
    if ("error" in animResult) {
      return reply.status(413).send({ reason: animResult.error });
    }
    if (animResult.npcWarnings.length > 0) {
      logger.info("office.npc_warnings", { officeId: office.id, warnings: animResult.npcWarnings });
    }
    const animByOrdinal = new Map(
      animResult.tilesetAnimations.map((a) => [a.ordinal, a.animations]),
    );
    const tilesetsWithAnims = saved.tilesets.map((t) => ({
      ...t,
      animations_json: JSON.stringify(animByOrdinal.get(t.ordinal) ?? []),
    }));
    const tilesetsRows = officesRepo.replaceTilesets(db, office.id, tilesetsWithAnims);

    npcsRepo.deleteNpcs(db, office.id);
    npcsRepo.insertNpcs(db, office.id, animResult.npcs);

    const features = parseTiledFeatures(tmjJson);
    featuresRepo.deleteFeatures(db, office.id);
    featuresRepo.insertFeatures(db, office.id, features);

    const finalOffice = officesRepo.findOfficeById(db, office.id)!;
    return reply.status(201).send({
      office: { ...finalOffice, tilesets: tilesetsRows },
      desksImported: importResult.imported,
      desksWarnings: importResult.warnings,
    });
  });

  app.patch("/api/offices/:id", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = request.params as { id: string };
    const officeId = Number(params.id);
    if (!Number.isInteger(officeId) || officeId <= 0) {
      return reply.status(400).send({ reason: "bad_request" });
    }
    if (!canAdminOffice(request.user!, officeId, db)) {
      return reply.status(403).send({ reason: "not_authorized" });
    }
    const existing = officesRepo.findOfficeById(db, officeId);
    if (!existing) return reply.status(404).send({ reason: "not_found" });

    if (!request.isMultipart()) {
      return reply.status(400).send({ reason: "expected_multipart" });
    }

    const partsResult = await readMultipart(request);
    if (!partsResult.ok)
      return reply.status(partsResult.status).send({ reason: partsResult.reason });

    const validation = await validateBundle(partsResult.parts);
    if (!validation.ok) {
      return reply
        .status(validation.status)
        .send({ reason: validation.reason, details: validation.details });
    }

    const { map, tilesetParts } = validation.data;
    const tile_width = map.map.tilewidth;
    const tile_height = map.map.tileheight;
    const cells_x = map.map.width;
    const cells_y = map.map.height;

    const saved = saveBundle({
      baseDir: env.OFFICE_MAPS_DIR,
      officeId,
      tmj: {
        buffer: partsResult.parts.tmj!.buffer,
        image_filenames: map.map.tilesets.map((t) => t.image),
      },
      tilesets: tilesetParts,
    });

    officesRepo.updateOfficeBundle(db, officeId, {
      tmj_filename: saved.tmjFilename,
      tile_width,
      tile_height,
      cells_x,
      cells_y,
      map_width: cells_x * tile_width,
      map_height: cells_y * tile_height,
    });
    const tmjJson = JSON.parse(partsResult.parts.tmj!.buffer.toString("utf-8")) as Record<
      string,
      unknown
    >;

    const animResult = parseTiledAnimationsAndNpcs(tmjJson);
    if ("error" in animResult) {
      return reply.status(413).send({ reason: animResult.error });
    }
    if (animResult.npcWarnings.length > 0) {
      logger.info("office.npc_warnings", { officeId, warnings: animResult.npcWarnings });
    }
    const animByOrdinal = new Map(
      animResult.tilesetAnimations.map((a) => [a.ordinal, a.animations]),
    );
    const tilesetsWithAnims = saved.tilesets.map((t) => ({
      ...t,
      animations_json: JSON.stringify(animByOrdinal.get(t.ordinal) ?? []),
    }));
    const tilesets = officesRepo.replaceTilesets(db, officeId, tilesetsWithAnims);

    npcsRepo.deleteNpcs(db, officeId);
    npcsRepo.insertNpcs(db, officeId, animResult.npcs);

    const features = parseTiledFeatures(tmjJson);
    featuresRepo.deleteFeatures(db, officeId);
    featuresRepo.insertFeatures(db, officeId, features);

    hub.broadcast(officeRoom(officeId), { type: "office.updated", officeId });

    const finalOffice = officesRepo.findOfficeById(db, officeId)!;
    return reply.status(200).send({ office: { ...finalOffice, tilesets }, desksImported: 0 });
  });

  app.get("/api/offices", { preHandler: app.requireAuth }, async (request, reply) => {
    const user = request.user!;
    const offices = officesRepo.listOffices(db);
    const defaultOfficeId = officesRepo.getUserDefaultOfficeId(db, user.id);
    const enriched = offices.map((o) => ({
      ...o,
      tilesets: officesRepo.listTilesets(db, o.id),
      is_admin: canAdminOffice(user, o.id, db),
      is_default: o.id === defaultOfficeId,
    }));
    return reply.status(200).send(enriched);
  });

  app.get("/api/offices/:id", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = request.params as { id: string };
    const officeId = Number(params.id);
    if (!Number.isInteger(officeId) || officeId <= 0) {
      return reply.status(400).send({ reason: "bad_request" });
    }
    const office = officesRepo.findOfficeById(db, officeId);
    if (!office) return reply.status(404).send({ reason: "not_found" });
    const tilesets = officesRepo.listTilesets(db, officeId);
    const desks = desksRepo.listByOffice(db, officeId);

    const query = request.query as { date?: string };
    const dateRaw = query.date ?? todayIso();
    const parsed = parseIsoDate(dateRaw);
    const date = parsed.ok ? parsed.date : todayIso();

    const rows = bookingsRepo.listByOfficeAndDate(db, officeId, date);
    const dailyByDeskId = new Map<number, (typeof rows)[number]>();
    for (const b of rows) dailyByDeskId.set(b.desk_id, b);

    const fixedRows = fixedRepo.listByOffice(db, officeId);

    const bookings: Array<{
      id: number;
      deskId: number;
      userId: number;
      type: "daily" | "fixed";
      date: string;
      user: { id: number; name: string; avatar_url: string | null };
    }> = [];

    for (const b of rows) {
      bookings.push({
        id: b.id,
        deskId: b.desk_id,
        userId: b.user_id,
        type: b.type,
        date: b.date,
        user: { id: b.user_id, name: b.userName, avatar_url: b.userAvatarUrl },
      });
    }
    for (const f of fixedRows) {
      if (dailyByDeskId.has(f.desk_id)) continue;
      bookings.push({
        id: -f.id,
        deskId: f.desk_id,
        userId: f.user_id,
        type: "fixed",
        date,
        user: { id: f.user_id, name: f.userName, avatar_url: f.userAvatarUrl },
      });
    }

    const features = featuresRepo.listFeatures(db, officeId);
    const npcRows = npcsRepo.listNpcs(db, officeId);
    const npcs = npcRows.map(({ id, name, x, y, sprite }) => ({ id, name, x, y, sprite }));
    const tilesetsWithAnimations = tilesets.map((t) => ({
      ...t,
      animations: JSON.parse(t.animations_json) as unknown[],
    }));

    return reply
      .status(200)
      .send({ office, tilesets: tilesetsWithAnimations, desks, bookings, date, features, npcs });
  });

  app.delete("/api/offices/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = request.params as { id: string };
    const officeId = Number(params.id);
    if (!Number.isInteger(officeId) || officeId <= 0) {
      return reply.status(400).send({ reason: "bad_request" });
    }
    officesRepo.deleteOffice(db, officeId);
    return reply.status(204).send();
  });

  app.get("/api/offices/:id/admins", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const office = officesRepo.findOfficeById(db, params.data.id);
    if (!office) return reply.status(404).send({ reason: "not_found" });

    return reply.send(officesRepo.listOfficeAdminsDetail(db, params.data.id));
  });

  app.get(
    "/api/offices/:id/fixed-assignments",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
      if (!params.success) return reply.status(400).send({ reason: "bad_request" });

      const office = officesRepo.findOfficeById(db, params.data.id);
      if (!office) return reply.status(404).send({ reason: "not_found" });

      return reply.send(fixedRepo.listByOfficeDetail(db, params.data.id));
    },
  );

  app.post("/api/offices/:id/admins", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ user_id: z.number().int().positive() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const office = officesRepo.findOfficeById(db, params.data.id);
    if (!office) return reply.status(404).send({ reason: "not_found" });

    officesRepo.addOfficeAdmin(db, params.data.id, body.data.user_id, request.user!.id);
    return reply.status(201).send();
  });

  app.delete(
    "/api/offices/:id/admins/:userId",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const params = z
        .object({
          id: z.coerce.number().int().positive(),
          userId: z.coerce.number().int().positive(),
        })
        .safeParse(request.params);
      if (!params.success) return reply.status(400).send({ reason: "bad_request" });

      const office = officesRepo.findOfficeById(db, params.data.id);
      if (!office) return reply.status(404).send({ reason: "not_found" });

      officesRepo.removeOfficeAdmin(db, params.data.id, params.data.userId);
      return reply.status(204).send();
    },
  );

  app.get("/maps/:officeId/:filename", async (request, reply) => {
    const params = request.params as { officeId: string; filename: string };
    const officeId = Number(params.officeId);
    if (!Number.isInteger(officeId) || officeId <= 0) {
      return reply.status(400).send({ reason: "bad_request" });
    }
    const result = serveSafe(env.OFFICE_MAPS_DIR, officeId, params.filename);
    if (!result.ok) {
      return reply
        .status(result.reason === "bad_filename" ? 400 : 404)
        .send({ reason: result.reason });
    }
    const filename = params.filename;
    const contentType = filename.endsWith(".tmj")
      ? "application/json"
      : filename.endsWith(".png")
        ? "image/png"
        : "image/webp";
    reply
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .type(contentType);
    return reply.send(createReadStream(result.absPath));
  });
}
