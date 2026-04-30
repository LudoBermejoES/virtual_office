import * as Sentry from "@sentry/node";
import type { Env } from "../../config/env.js";
import { env as globalEnv } from "../../config/env.js";

export function initSentry(e: Env = globalEnv): void {
  if (!e.SENTRY_DSN) return;

  Sentry.init({
    dsn: e.SENTRY_DSN,
    environment: e.NODE_ENV,
    tracesSampleRate: e.NODE_ENV === "production" ? 0.1 : 1.0,
    ...(e.GIT_SHA ? { release: e.GIT_SHA } : {}),
  });

  if (e.GIT_SHA) {
    Sentry.setTag("release", e.GIT_SHA);
  }
}

export function isSentryEnabled(): boolean {
  return Boolean(globalEnv.SENTRY_DSN);
}
