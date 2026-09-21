import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  listUsers,
  findUserByEmail,
  updateUserRole,
  findUserById,
  isPlaceholder,
} from "../../infra/repos/users.js";
import { listDailyBookedUserIds } from "../../infra/repos/bookings.js";
import { parseIsoDate } from "../../domain/bookings.js";
import { logger } from "../../config/logger.js";
import type { Env } from "../../config/env.js";

export async function usersRoutes(
  app: FastifyInstance,
  { db }: { db: DatabaseSync; env: Env },
): Promise<void> {
  app.get("/api/users", { preHandler: app.requireAdmin }, async (request, reply) => {
    // `includePlaceholders` incluye los "Bloqueado #N" (change 031). Por
    // defecto van fuera para que la pestaña USUARIOS no los mezcle con
    // personas; el modal de reserva y la pestaña FIJOS sí los piden.
    const query = z
      .object({
        email: z.string().email().optional(),
        includePlaceholders: z.enum(["0", "1"]).optional(),
        date: z.string().optional(),
      })
      .safeParse(request.query);
    if (!query.success) return reply.status(400).send({ reason: "bad_request" });

    if (query.data.email) {
      const user = findUserByEmail(db, query.data.email);
      return reply.send(user ? [user] : []);
    }

    const rows = listUsers(db, { includePlaceholders: query.data.includePlaceholders === "1" });
    if (query.data.date === undefined) return reply.send(rows);

    // Con `date` anotamos `has_daily_booking` sobre cada fila: quién ya tiene
    // una reserva daily ese día en CUALQUIER oficina. El modal de reserva del
    // admin lo usa para deshabilitar a los placeholders agotados en vez de
    // dejar que el POST falle con 409 `user_already_booked_today` (change 031).
    const date = parseIsoDate(query.data.date);
    if (!date.ok) return reply.status(400).send({ reason: "bad_request" });

    const booked = new Set(listDailyBookedUserIds(db, date.date));
    return reply.send(rows.map((u) => ({ ...u, has_daily_booking: booked.has(u.id) ? 1 : 0 })));
  });

  app.patch("/api/users/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ role: z.enum(["admin", "member"]) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    // Los placeholders "Bloqueado #N" no son personas: no se promueven ni se
    // degradan (change 031).
    const target = findUserById(db, params.data.id);
    if (!target) return reply.status(404).send({ reason: "user_not_found" });
    if (isPlaceholder(target)) {
      return reply.status(409).send({ reason: "cannot_modify_placeholder" });
    }

    updateUserRole(db, params.data.id, body.data.role);
    logger.info("user.role_changed", {
      targetUserId: params.data.id,
      newRole: body.data.role,
      changedBy: request.user!.id,
    });
    return reply.status(200).send({ ok: true });
  });
}
