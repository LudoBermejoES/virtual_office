import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyJwt } from "../../infra/auth/session.js";
import { findUserById } from "../../infra/repos/users.js";
import type { DatabaseSync } from "node:sqlite";
import type { Env } from "../../config/env.js";

const COOKIE_NAME = "session";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: number; role: "admin" | "member" };
  }
}

export async function authGuard(
  app: FastifyInstance,
  { db, env }: { db: DatabaseSync; env: Env },
): Promise<void> {
  async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies[COOKIE_NAME];
    if (!token) {
      return reply.status(401).send({ reason: "no_session" });
    }

    let sessionPayload: Awaited<ReturnType<typeof verifyJwt>>;
    try {
      sessionPayload = await verifyJwt(
        token,
        env.SESSION_SECRET,
        env.SESSION_SECRET_PREVIOUS || undefined,
      );
    } catch {
      return reply.status(401).send({ reason: "invalid_session" });
    }

    const user = findUserById(db, sessionPayload.sub);
    if (!user) return reply.status(401).send({ reason: "user_not_found" });

    request.user = { id: user.id, role: user.role };
  }

  async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(request, reply);
    if (reply.sent) return;

    if (request.user?.role !== "admin") {
      return reply.status(403).send({ reason: "forbidden" });
    }
  }

  app.decorate("requireAuth", requireAuth);
  app.decorate("requireAdmin", requireAdmin);

  app.get("/api/admin/ping", { preHandler: requireAdmin }, async () => ({ ok: true }));
}
