import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { verifyJwt } from "../../infra/auth/session.js";
import { findUserById } from "../../infra/repos/users.js";
import type { DatabaseSync } from "node:sqlite";
import type { Env } from "../../config/env.js";

const COOKIE_NAME = "session";

type Guard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: number; role: "admin" | "member" };
  }
  interface FastifyInstance {
    requireAuth: Guard;
    requireAdmin: Guard;
  }
}

async function authGuardImpl(
  app: FastifyInstance,
  { db, env }: { db: DatabaseSync; env: Env },
): Promise<void> {
  const requireAuth: Guard = async (request, reply) => {
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
  };

  const requireAdmin: Guard = async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    if (request.user?.role !== "admin") {
      return reply.status(403).send({ reason: "forbidden" });
    }
  };

  app.decorate("requireAuth", requireAuth);
  app.decorate("requireAdmin", requireAdmin);

  app.get("/api/admin/ping", { preHandler: requireAdmin }, async () => ({ ok: true }));
}

export const authGuard = fp(authGuardImpl, { name: "auth-guard" });
