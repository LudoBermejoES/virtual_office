import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { isSentryEnabled } from "../../infra/observability/sentry.js";

// Versiones enteras derivadas de los ficheros en src/infra/db/migrations/
const EXPECTED_MIGRATIONS = [1, 2, 3, 4, 5, 6];

export async function healthRoutes(
  app: FastifyInstance,
  { db }: { db: DatabaseSync },
): Promise<void> {
  app.get("/readyz", { logLevel: "silent" }, async (_request, reply) => {
    try {
      db.prepare("SELECT 1").get();
    } catch {
      return reply.status(503).send({ status: "degraded", reason: "db_down" });
    }

    const applied = new Set(
      (db.prepare("SELECT version FROM _migrations").all() as { version: number }[]).map(
        (r) => r.version,
      ),
    );
    const missing = EXPECTED_MIGRATIONS.filter((v) => !applied.has(v));
    if (missing.length > 0) {
      return reply.status(503).send({ status: "degraded", reason: "migrations_pending", missing });
    }

    return reply.send({ status: "ready" });
  });

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
