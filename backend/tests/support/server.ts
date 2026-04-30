import type { DatabaseSync } from "node:sqlite";
import { buildServer } from "../../src/http/server.js";
import { parseEnv } from "../../src/config/env.js";
import type { GoogleVerifier } from "../../src/infra/auth/google-verifier.js";
import type { Env } from "../../src/config/env.js";

const defaultTestEnv = parseEnv({
  SESSION_SECRET: process.env["SESSION_SECRET"] ?? "supersecretodealmenos32caracteresaqui",
  TEIMAS_DOMAINS: process.env["TEIMAS_DOMAINS"] ?? "teimas.com",
  ADMIN_EMAILS: process.env["ADMIN_EMAILS"] ?? "",
});

export interface TestServer {
  app: Awaited<ReturnType<typeof buildServer>>;
  teardown: () => Promise<void>;
}

export interface StartTestServerOptions {
  db: DatabaseSync;
  googleVerifier?: GoogleVerifier;
  env?: Env;
}

export async function startTestServer({
  db,
  googleVerifier,
  env,
}: StartTestServerOptions): Promise<TestServer> {
  const app = await buildServer({ db, googleVerifier, env: env ?? defaultTestEnv });
  await app.ready();

  return {
    app,
    teardown: async () => {
      await app.close();
    },
  };
}
