/**
 * Endpoints CRUD para weekly_assignments (change 027).
 *
 *   POST   /api/desks/:id/weekly                  body { userId, dow }
 *   DELETE /api/desks/:id/weekly/:weeklyId
 *   GET    /api/offices/:id/weekly                listado admin
 *
 * Todos requieren rol admin sobre la oficina del desk/oficina referenciada.
 */
import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { logger } from "../../config/logger.js";
import * as weeklyRepo from "../../infra/repos/weekly-assignments.js";
import * as fixedRepo from "../../infra/repos/fixed-assignments.js";
import * as desksRepo from "../../infra/repos/desks.js";
import * as officesRepo from "../../infra/repos/offices.js";
import { findUserById } from "../../infra/repos/users.js";
import { canAdminOffice } from "../../services/auth.service.js";
import type { Env } from "../../config/env.js";

export async function weeklyRoutes(
  app: FastifyInstance,
  { db }: { db: DatabaseSync; env: Env },
): Promise<void> {
  app.post("/api/desks/:id/weekly", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z
      .object({
        userId: z.coerce.number().int().positive(),
        dow: z.coerce.number().int().min(0).max(6),
      })
      .safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (!desk) return reply.status(404).send({ reason: "desk_not_found" });
    if (!canAdminOffice(request.user!, desk.office_id, db)) {
      return reply.status(403).send({ reason: "not_authorized" });
    }

    const user = findUserById(db, body.data.userId);
    if (!user) return reply.status(404).send({ reason: "user_not_found" });

    if (fixedRepo.findByDeskId(db, desk.id)) {
      return reply.status(409).send({ reason: "desk_has_fixed_assignment" });
    }

    try {
      const weekly = weeklyRepo.createWeekly(db, {
        desk_id: desk.id,
        user_id: user.id,
        dow: body.data.dow,
        created_by_user_id: request.user!.id,
      });
      logger.info("weekly.created", {
        weeklyId: weekly.id,
        deskId: desk.id,
        userId: user.id,
        dow: weekly.dow,
        createdBy: request.user!.id,
      });
      return reply.status(201).send({ weekly });
    } catch (e) {
      if (e instanceof weeklyRepo.WeeklyAssignmentConflict) {
        if (e.column === "desk_dow") {
          return reply.status(409).send({ reason: "weekly_dow_conflict" });
        }
        return reply.status(409).send({ reason: "user_dow_conflict" });
      }
      throw e;
    }
  });

  app.delete(
    "/api/desks/:id/weekly/:weeklyId",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const params = z
        .object({
          id: z.coerce.number().int().positive(),
          weeklyId: z.coerce.number().int().positive(),
        })
        .safeParse(request.params);
      if (!params.success) return reply.status(400).send({ reason: "bad_request" });

      const desk = desksRepo.findDeskById(db, params.data.id);
      if (!desk) return reply.status(404).send({ reason: "desk_not_found" });
      if (!canAdminOffice(request.user!, desk.office_id, db)) {
        return reply.status(403).send({ reason: "not_authorized" });
      }

      const weekly = weeklyRepo.findWeeklyById(db, params.data.weeklyId);
      if (!weekly) return reply.status(404).send({ reason: "weekly_not_found" });
      if (weekly.desk_id !== desk.id) {
        return reply.status(404).send({ reason: "weekly_not_found" });
      }

      weeklyRepo.deleteWeeklyById(db, weekly.id);
      logger.info("weekly.deleted", {
        weeklyId: weekly.id,
        deskId: desk.id,
        deletedBy: request.user!.id,
      });
      return reply.status(204).send();
    },
  );

  app.get("/api/offices/:id/weekly", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const office = officesRepo.findOfficeById(db, params.data.id);
    if (!office) return reply.status(404).send({ reason: "not_found" });
    if (!canAdminOffice(request.user!, office.id, db)) {
      return reply.status(403).send({ reason: "not_authorized" });
    }

    return reply.status(200).send(weeklyRepo.listByOffice(db, office.id));
  });
}
