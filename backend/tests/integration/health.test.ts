import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../../src/http/server.js";
import { setupTestDb } from "../support/db.js";

describe("GET /healthz", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const { db, cleanup } = setupTestDb();

  beforeAll(async () => {
    server = await buildServer({ db });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    cleanup();
  });

  it("devuelve 200 con db ok", async () => {
    const res = await server.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ status: string; db: string; sentry: string }>();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(["on", "off"]).toContain(body.sentry);
  });

  it("devuelve 503 cuando la DB falla", async () => {
    const brokenServer = await buildServer({
      prepare: () => {
        throw new Error("DB error simulado");
      },
    } as never);
    await brokenServer.ready();

    const res = await brokenServer.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(503);
    const body = res.json<{ status: string; db: string }>();
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("error");

    await brokenServer.close();
  });
});
