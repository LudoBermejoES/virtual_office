import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { listUsers, findUserByEmail, updateUserRole } from "../../infra/repos/users.js";
import type { Env } from "../../config/env.js";

export async function usersRoutes(
  app: FastifyInstance,
  { db }: { db: DatabaseSync; env: Env },
): Promise<void> {
  app.get("/api/users", { preHandler: app.requireAdmin }, async (request, reply) => {
    const query = z.object({ email: z.string().email().optional() }).safeParse(request.query);
    if (!query.success) return reply.status(400).send({ reason: "bad_request" });

    if (query.data.email) {
      const user = findUserByEmail(db, query.data.email);
      return reply.send(user ? [user] : []);
    }

    return reply.send(listUsers(db));
  });

  app.patch("/api/users/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    const body = z.object({ role: z.enum(["admin", "member"]) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    updateUserRole(db, params.data.id, body.data.role);
    return reply.status(200).send({ ok: true });
  });
}
