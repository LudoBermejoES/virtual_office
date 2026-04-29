import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { buildServer } from "../../src/http/server.js";
import { runMigrations } from "../../src/infra/db/migrations.js";

describe("GET /healthz", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  let db: DatabaseSync;

  beforeAll(async () => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    runMigrations(db);
    server = await buildServer(db);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    db.close();
  });

  it("devuelve 200 con db ok", async () => {
    const res = await server.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ status: string; db: string; sentry: string }>();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(["on", "off"]).toContain(body.sentry);
  });
});
