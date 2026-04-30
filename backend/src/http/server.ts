import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import type { DatabaseSync } from "node:sqlite";
import { env as defaultEnv } from "../config/env.js";
import type { Env } from "../config/env.js";
import { errorHandler } from "./plugins/error-handler.js";
import { authGuard } from "./plugins/auth-guard.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { invitationsRoutes } from "./routes/invitations.js";
import { officesRoutes } from "./routes/offices.js";
import { desksRoutes } from "./routes/desks.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { fixedAssignmentsRoutes } from "./routes/fixed-assignments.js";
import type { GoogleVerifier } from "../infra/auth/google-verifier.js";

export interface ServerDeps {
  db: DatabaseSync;
  googleVerifier?: GoogleVerifier;
  env?: Env;
}

export async function buildServer({ db, googleVerifier, env: envOverride }: ServerDeps) {
  const env = envOverride ?? defaultEnv;
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  await app.register(cookie);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(multipart, {
    limits: {
      fileSize: 2 * 1024 * 1024,
      fields: 20,
      files: 10,
    },
  });
  await app.register(errorHandler);

  await app.register(healthRoutes, { db });
  await app.register(authRoutes, { db, googleVerifier, env });
  await app.register(authGuard, { db, env });
  await app.register(invitationsRoutes, { db, env });
  await app.register(officesRoutes, { db, env });
  await app.register(desksRoutes, { db, env });
  await app.register(bookingsRoutes, { db, env });
  await app.register(fixedAssignmentsRoutes, { db, env });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  return app;
}

export { defaultEnv as env };
