import Fastify from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { env } from "../config/env.js";
import { errorHandler } from "./plugins/error-handler.js";
import { healthRoutes } from "./routes/health.js";

export async function buildServer(db: DatabaseSync) {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  await app.register(errorHandler);

  await app.register(healthRoutes, { db });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  return app;
}

export { env };
