import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { validateDeskPlacement } from "@virtual-office/shared";
import * as desksRepo from "../../infra/repos/desks.js";
import * as officesRepo from "../../infra/repos/offices.js";
import { parseDesksFromTiled } from "../../domain/desks-from-tiled.js";
import type { Env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

interface ImportWarning {
  objectId?: number;
  label?: string;
  reason: string;
}

export interface ImportFromTiledResult {
  imported: number;
  warnings: ImportWarning[];
}

export function importDesksFromTiled(
  db: DatabaseSync,
  officeId: number,
  baseDir: string,
): ImportFromTiledResult {
  const office = officesRepo.findOfficeById(db, officeId);
  if (!office) return { imported: 0, warnings: [] };

  let tmj: unknown;
  try {
    const path = join(baseDir, String(officeId), office.tmj_filename);
    tmj = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { imported: 0, warnings: [{ reason: "tmj_not_found" }] };
  }

  const parsed = parseDesksFromTiled(tmj as { layers?: never });
  const warnings: ImportWarning[] = parsed.warnings.map((w) => ({
    objectId: w.objectId,
    reason: w.reason,
  }));

  let imported = 0;
  const existingDesks = desksRepo.listByOffice(db, officeId);
  const existingByLabel = new Map(existingDesks.map((d) => [d.label, d]));
  const positions = existingDesks.map((d) => ({ x: d.x, y: d.y }));
  const bounds = { width: office.map_width, height: office.map_height };

  for (const candidate of parsed.desks) {
    const existing = existingByLabel.get(candidate.label);
    if (existing) {
      if (existing.source === "manual") {
        warnings.push({
          objectId: candidate.objectId,
          label: candidate.label,
          reason: "label_taken_by_manual",
        });
      }
      continue;
    }

    const validation = validateDeskPlacement(candidate.x, candidate.y, bounds, positions);
    if (!validation.ok) {
      warnings.push({
        objectId: candidate.objectId,
        label: candidate.label,
        reason: validation.reason,
      });
      continue;
    }

    const created = desksRepo.createDesk(db, {
      office_id: officeId,
      label: candidate.label,
      x: candidate.x,
      y: candidate.y,
      source: "tiled",
    });
    positions.push({ x: created.x, y: created.y });
    existingByLabel.set(candidate.label, created);
    imported += 1;
  }

  return { imported, warnings };
}

export async function desksRoutes(
  app: FastifyInstance,
  { db, env }: { db: DatabaseSync; env: Env },
): Promise<void> {
  app.post("/api/offices/:id/desks", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z
      .object({ label: z.string().min(1).max(80), x: z.number(), y: z.number() })
      .safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const office = officesRepo.findOfficeById(db, params.data.id);
    if (!office) return reply.status(404).send({ reason: "not_found" });

    if (desksRepo.countByOffice(db, office.id) >= env.MAX_DESKS_PER_OFFICE) {
      return reply.status(422).send({ reason: "office_full" });
    }

    const x = Math.round(body.data.x);
    const y = Math.round(body.data.y);

    const others = desksRepo.listByOffice(db, office.id).map((d) => ({ x: d.x, y: d.y }));
    const validation = validateDeskPlacement(
      x,
      y,
      { width: office.map_width, height: office.map_height },
      others,
    );
    if (!validation.ok) {
      return reply.status(422).send({ reason: validation.reason });
    }

    if (desksRepo.findByLabel(db, office.id, body.data.label)) {
      return reply.status(409).send({ reason: "label_taken" });
    }

    const desk = desksRepo.createDesk(db, {
      office_id: office.id,
      label: body.data.label,
      x,
      y,
    });
    return reply.status(201).send({ desk });
  });

  app.patch("/api/desks/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z
      .object({
        label: z.string().min(1).max(80).optional(),
        x: z.number().optional(),
        y: z.number().optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (!desk) return reply.status(404).send({ reason: "not_found" });

    const office = officesRepo.findOfficeById(db, desk.office_id);
    if (!office) return reply.status(404).send({ reason: "office_not_found" });

    const newX = body.data.x !== undefined ? Math.round(body.data.x) : desk.x;
    const newY = body.data.y !== undefined ? Math.round(body.data.y) : desk.y;

    if (body.data.x !== undefined || body.data.y !== undefined) {
      const others = desksRepo
        .listByOffice(db, office.id)
        .filter((d) => d.id !== desk.id)
        .map((d) => ({ x: d.x, y: d.y }));
      const validation = validateDeskPlacement(
        newX,
        newY,
        { width: office.map_width, height: office.map_height },
        others,
      );
      if (!validation.ok) {
        return reply.status(422).send({ reason: validation.reason });
      }
    }

    if (body.data.label !== undefined && body.data.label !== desk.label) {
      const collision = desksRepo.findByLabel(db, office.id, body.data.label);
      if (collision) return reply.status(409).send({ reason: "label_taken" });
    }

    const updated = desksRepo.updateDesk(db, desk.id, {
      ...(body.data.label !== undefined ? { label: body.data.label } : {}),
      ...(body.data.x !== undefined ? { x: newX } : {}),
      ...(body.data.y !== undefined ? { y: newY } : {}),
    });
    return reply.status(200).send({ desk: updated });
  });

  app.delete("/api/desks/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });
    desksRepo.deleteDesk(db, params.data.id);
    return reply.status(204).send();
  });

  app.post(
    "/api/offices/:id/desks/import-from-tiled",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
      if (!params.success) return reply.status(400).send({ reason: "bad_request" });

      const result = importDesksFromTiled(db, params.data.id, env.OFFICE_MAPS_DIR);
      logger.info("desks.imported", {
        officeId: params.data.id,
        imported: result.imported,
        warnings: result.warnings.length,
      });
      return reply.status(200).send(result);
    },
  );
}
