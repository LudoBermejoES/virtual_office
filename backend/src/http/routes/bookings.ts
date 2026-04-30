import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import * as bookingsRepo from "../../infra/repos/bookings.js";
import * as desksRepo from "../../infra/repos/desks.js";
import { isInWindow, parseIsoDate, todayIso } from "../../domain/bookings.js";
import { UniqueViolation } from "../../infra/repos/bookings.js";
import type { Env } from "../../config/env.js";

export async function bookingsRoutes(
  app: FastifyInstance,
  { db, env }: { db: DatabaseSync; env: Env },
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

    try {
      const booking = bookingsRepo.createBooking(db, {
        desk_id: desk.id,
        user_id: request.user!.id,
        date: parsedDate.date,
        type: "daily",
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
    return reply.status(204).send();
  });
}
