import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { logger } from "../../config/logger.js";
import * as bookingsRepo from "../../infra/repos/bookings.js";
import * as desksRepo from "../../infra/repos/desks.js";
import * as fixedRepo from "../../infra/repos/fixed-assignments.js";
import { findUserById } from "../../infra/repos/users.js";
import { isInWindow, parseIsoDate, todayIso } from "../../domain/bookings.js";
import { UniqueViolation } from "../../infra/repos/bookings.js";
import { officeRoom } from "../../infra/ws/hub.js";
import type { WsHub } from "../../infra/ws/hub.js";
import type { Env } from "../../config/env.js";

export async function bookingsRoutes(
  app: FastifyInstance,
  { db, env, hub }: { db: DatabaseSync; env: Env; hub: WsHub },
): Promise<void> {
  app.post("/api/desks/:id/bookings", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ date: z.string() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const parsedDate = parseIsoDate(body.data.date);
    if (!parsedDate.ok) return reply.status(422).send({ reason: "invalid_date" });

    const today = todayIso();
    if (parsedDate.date < today) {
      return reply.status(422).send({ reason: "date_in_past" });
    }
    if (!isInWindow(parsedDate.date, today, env.BOOKING_HORIZON_DAYS)) {
      return reply.status(422).send({ reason: "date_out_of_horizon" });
    }

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (!desk) return reply.status(404).send({ reason: "desk_not_found" });

    if (fixedRepo.findByDeskId(db, desk.id)) {
      return reply.status(409).send({ reason: "desk_has_fixed_assignment" });
    }

    try {
      const booking = bookingsRepo.createBooking(db, {
        desk_id: desk.id,
        user_id: request.user!.id,
        date: parsedDate.date,
        type: "daily",
      });
      const user = findUserById(db, booking.user_id);
      if (user) {
        hub.broadcast(officeRoom(desk.office_id), {
          type: "desk.booked",
          deskId: desk.id,
          date: booking.date,
          user: { id: user.id, name: user.name, avatar_url: user.avatar_url },
        });
      }
      logger.info("booking.created", {
        bookingId: booking.id,
        deskId: desk.id,
        userId: booking.user_id,
        date: booking.date,
      });
      return reply.status(201).send({ booking });
    } catch (e) {
      if (e instanceof UniqueViolation) {
        if (e.column === "desk_id_date") {
          return reply.status(409).send({ reason: "desk_already_booked" });
        }
        return reply.status(409).send({ reason: "user_already_booked_today" });
      }
      throw e;
    }
  });

  app.delete("/api/desks/:id/bookings", { preHandler: app.requireAuth }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ date: z.string() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const parsedDate = parseIsoDate(body.data.date);
    if (!parsedDate.ok) return reply.status(422).send({ reason: "invalid_date" });

    const existing = bookingsRepo.findBy(db, {
      desk_id: params.data.id,
      date: parsedDate.date,
    });
    if (!existing) return reply.status(404).send({ reason: "not_found" });

    const me = request.user!;
    if (existing.user_id !== me.id && me.role !== "admin") {
      return reply.status(403).send({ reason: "forbidden" });
    }
    if (existing.type === "fixed") {
      return reply.status(409).send({ reason: "cannot_release_fixed" });
    }

    bookingsRepo.deleteBy(db, { desk_id: params.data.id, date: parsedDate.date });
    logger.info("booking.deleted", {
      bookingId: existing.id,
      deskId: params.data.id,
      userId: existing.user_id,
      date: parsedDate.date,
      deletedBy: me.id,
    });
    const desk = desksRepo.findDeskById(db, params.data.id);
    if (desk) {
      hub.broadcast(officeRoom(desk.office_id), {
        type: "desk.released",
        deskId: desk.id,
        date: parsedDate.date,
      });
    }
    return reply.status(204).send();
  });
}
