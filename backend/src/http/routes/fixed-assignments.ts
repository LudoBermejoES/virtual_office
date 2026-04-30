import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import * as fixedRepo from "../../infra/repos/fixed-assignments.js";
import * as desksRepo from "../../infra/repos/desks.js";
import { findUserById } from "../../infra/repos/users.js";
import { officeRoom } from "../../infra/ws/hub.js";
import type { WsHub } from "../../infra/ws/hub.js";
import type { Env } from "../../config/env.js";

export async function fixedAssignmentsRoutes(
  app: FastifyInstance,
  { db, hub }: { db: DatabaseSync; env: Env; hub: WsHub },
): Promise<void> {
  app.post("/api/desks/:id/fixed", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ userId: z.coerce.number().int().positive() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (!desk) return reply.status(404).send({ reason: "desk_not_found" });

    const user = findUserById(db, body.data.userId);
    if (!user) return reply.status(404).send({ reason: "user_not_found" });

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

  app.delete("/api/desks/:id/fixed", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const removed = fixedRepo.deleteFixedAssignmentByDesk(db, params.data.id);
    if (!removed) return reply.status(404).send({ reason: "not_found" });

    const desk = desksRepo.findDeskById(db, params.data.id);
    if (desk) {
      hub.broadcast(officeRoom(desk.office_id), {
        type: "desk.unfixed",
        deskId: desk.id,
      });
    }
    return reply.status(204).send();
  });
}
