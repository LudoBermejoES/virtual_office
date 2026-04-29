import type { DatabaseSync } from "node:sqlite";
import { buildServer } from "../../src/http/server.js";

export interface TestServer {
  app: Awaited<ReturnType<typeof buildServer>>;
  teardown: () => Promise<void>;
}

export interface StartTestServerOptions {
  db: DatabaseSync;
}

export async function startTestServer({ db }: StartTestServerOptions): Promise<TestServer> {
  const app = await buildServer(db);
  await app.ready();

  return {
    app,
    teardown: async () => {
      await app.close();
    },
  };
}
