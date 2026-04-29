import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { isSentryEnabled } from "../../infra/observability/sentry.js";

export async function healthRoutes(
  app: FastifyInstance,
  { db }: { db: DatabaseSync },
): Promise<void> {
  app.get("/healthz", { logLevel: "silent" }, async (_request, reply) => {
    let dbStatus: "ok" | "error" = "ok";
    try {
      db.prepare("SELECT 1").get();
    } catch {
      dbStatus = "error";
    }

    const status = dbStatus === "ok" ? "ok" : "degraded";
    const httpStatus = status === "ok" ? 200 : 503;

    return reply.status(httpStatus).send({
      status,
      db: dbStatus,
      sentry: isSentryEnabled() ? "on" : "off",
    });
  });
}
