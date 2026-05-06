import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { logger } from "../../config/logger.js";
import * as fixedRepo from "../../infra/repos/fixed-assignments.js";
import * as exceptionsRepo from "../../infra/repos/fixed-exceptions.js";
import * as desksRepo from "../../infra/repos/desks.js";
import { findUserById } from "../../infra/repos/users.js";
import { officeRoom } from "../../infra/ws/hub.js";
import type { WsHub } from "../../infra/ws/hub.js";
import { canAdminOffice } from "../../services/auth.service.js";
import { isInWindow, parseIsoDate, todayIso } from "../../domain/bookings.js";
import type { Env } from "../../config/env.js";

export async function fixedAssignmentsRoutes(
  app: FastifyInstance,
  { db, env, hub }: { db: DatabaseSync; env: Env; hub: WsHub },
): Promise<void> {
  app.post("/api/desks/:id/fixed", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ userId: z.coerce.number().int().positive() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (!desk) return reply.status(404).send({ reason: "desk_not_found" });
    if (!canAdminOffice(request.user!, desk.office_id, db)) {
      return reply.status(403).send({ reason: "not_authorized" });
    }

    const user = findUserById(db, body.data.userId);
    if (!user) return reply.status(404).send({ reason: "user_not_found" });

    // Si el usuario ya tiene un fijo en otro puesto, liberarlo antes
    const existing = fixedRepo.findByUserId(db, user.id);
    if (existing && existing.desk_id !== desk.id) {
      fixedRepo.deleteFixedAssignmentByDesk(db, existing.desk_id);
      hub.broadcast(officeRoom(desk.office_id), { type: "desk.unfixed", deskId: existing.desk_id });
    }

    try {
      const fixed = fixedRepo.createFixedAssignment(db, {
        desk_id: desk.id,
        user_id: user.id,
        assigned_by_user_id: request.user!.id,
      });
      hub.broadcast(officeRoom(desk.office_id), {
        type: "desk.fixed",
        deskId: desk.id,
        user: { id: user.id, name: user.name, avatar_url: user.avatar_url },
      });
      logger.info("fixed.assigned", {
        deskId: desk.id,
        userId: user.id,
        assignedBy: request.user!.id,
      });
      return reply.status(201).send({ fixed });
    } catch (e) {
      if (e instanceof fixedRepo.FixedAssignmentConflict) {
        if (e.column === "desk_id") {
          return reply.status(409).send({ reason: "desk_already_fixed" });
        }
        return reply.status(409).send({ reason: "user_already_has_fixed" });
      }
      throw e;
    }
  });

  app.delete("/api/desks/:id/fixed", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const deskForAuth = desksRepo.findDeskById(db, params.data.id);
    if (deskForAuth && !canAdminOffice(request.user!, deskForAuth.office_id, db)) {
      return reply.status(403).send({ reason: "not_authorized" });
    }

    const removed = fixedRepo.deleteFixedAssignmentByDesk(db, params.data.id);
    if (!removed) return reply.status(404).send({ reason: "not_found" });
    logger.info("fixed.removed", { deskId: params.data.id, removedBy: request.user!.id });

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (desk) {
      hub.broadcast(officeRoom(desk.office_id), {
        type: "desk.unfixed",
        deskId: desk.id,
      });
    }
    return reply.status(204).send();
  });

  // ── Excepciones por día ─────────────────────────────────────────────────────
  app.post("/api/desks/:id/fixed/skip", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ date: z.string() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const parsedDate = parseIsoDate(body.data.date);
    if (!parsedDate.ok) return reply.status(400).send({ reason: "invalid_date" });

    const today = todayIso();
    if (parsedDate.date < today) {
      return reply.status(400).send({ reason: "date_in_past" });
    }
    if (!isInWindow(parsedDate.date, today, env.BOOKING_HORIZON_DAYS)) {
      return reply.status(400).send({ reason: "date_out_of_horizon" });
    }

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (!desk) return reply.status(404).send({ reason: "desk_not_found" });

    const fixed = fixedRepo.findByDeskId(db, desk.id);
    if (!fixed) return reply.status(404).send({ reason: "fixed_not_found" });

    const me = request.user!;
    const isOwner = fixed.user_id === me.id;
    const isAdmin = canAdminOffice(me, desk.office_id, db);
    if (!isOwner && !isAdmin) {
      return reply.status(403).send({ reason: "not_authorized" });
    }

    const exception = exceptionsRepo.createException(db, fixed.id, parsedDate.date, me.id);

    hub.broadcast(officeRoom(desk.office_id), {
      type: "desk.fixed_skipped",
      deskId: desk.id,
      userId: fixed.user_id,
      date: parsedDate.date,
    });
    logger.info("fixed.day_skipped", {
      deskId: desk.id,
      userId: fixed.user_id,
      date: parsedDate.date,
      byUserId: me.id,
    });

    return reply.status(200).send({ exception });
  });

  app.delete(
    "/api/desks/:id/fixed/skip",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
      if (!params.success) return reply.status(400).send({ reason: "bad_request" });

      const body = z.object({ date: z.string() }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ reason: "bad_request" });

      const parsedDate = parseIsoDate(body.data.date);
      if (!parsedDate.ok) return reply.status(400).send({ reason: "invalid_date" });

      const desk = desksRepo.findDeskById(db, params.data.id);
      if (!desk) return reply.status(404).send({ reason: "desk_not_found" });

      const fixed = fixedRepo.findByDeskId(db, desk.id);
      if (!fixed) return reply.status(404).send({ reason: "fixed_not_found" });

      const me = request.user!;
      const isOwner = fixed.user_id === me.id;
      const isAdmin = canAdminOffice(me, desk.office_id, db);
      if (!isOwner && !isAdmin) {
        return reply.status(403).send({ reason: "not_authorized" });
      }

      const removed = exceptionsRepo.deleteException(db, fixed.id, parsedDate.date);
      if (!removed) return reply.status(404).send({ reason: "not_found" });

      hub.broadcast(officeRoom(desk.office_id), {
        type: "desk.fixed_unskipped",
        deskId: desk.id,
        userId: fixed.user_id,
        date: parsedDate.date,
      });
      logger.info("fixed.day_unskipped", {
        deskId: desk.id,
        userId: fixed.user_id,
        date: parsedDate.date,
        byUserId: me.id,
      });

      return reply.status(204).send();
    },
  );
}
