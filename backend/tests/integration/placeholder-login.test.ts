import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupTestDb } from "../support/db.js";
import { startTestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";
import { logger } from "../../src/config/logger.js";
import type { TestServer } from "../support/server.js";
import type { TestDb } from "../support/db.js";

/**
 * Change 031: los placeholders "Bloqueado #N" nunca pueden iniciar sesión.
 *
 * Tres salvaguardas independientes:
 *  1. `google_sub` sintético (`placeholder:N`) que ningún `sub` de Google
 *     puede igualar, así que el upsert nunca aterriza en estas filas.
 *  2. Dominio `teimas.space` fuera de `TEIMAS_DOMAINS`.
 *  3. Rechazo explícito `403 placeholder_cannot_login`, que es el que protege
 *     si algún día se añade ese dominio a los permitidos.
 */
describe("POST /api/auth/google — placeholders (change 031)", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    vi.restoreAllMocks();
  });

  describe("con teimas.space hipotéticamente permitido", () => {
    beforeEach(async () => {
      testDb = setupTestDb();
      verifier = new FakeGoogleVerifier();
      // Escenario del spec: aunque el dominio del placeholder estuviera
      // permitido, el login debe rechazarse por is_placeholder = 1.
      const env = parseEnv({
        SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
        TEIMAS_DOMAINS: "teimas.com,teimas.space",
        ADMIN_EMAILS: "",
      });
      server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never, env });
    });

    it("login que resuelve a un placeholder devuelve 403 placeholder_cannot_login sin cookie", async () => {
      verifier.setNextPayload({
        sub: "placeholder:1",
        email: "bloqueado1@teimas.space",
        hd: "teimas.space",
        name: "Bloqueado #1",
        email_verified: true,
      });

      const res = await server.app.inject({
        method: "POST",
        url: "/api/auth/google",
        body: { idToken: "fake-token" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ reason: "placeholder_cannot_login" });
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("ese intento no modifica la fila del placeholder", async () => {
      const before = testDb.db
        .prepare("SELECT * FROM users WHERE google_sub = 'placeholder:1'")
        .get() as Record<string, unknown>;

      verifier.setNextPayload({
        sub: "placeholder:1",
        email: "bloqueado1@teimas.space",
        hd: "teimas.space",
        name: "Nombre Inyectado",
        email_verified: true,
        picture: "https://evil.example.com/x.png",
      });
      await server.app.inject({
        method: "POST",
        url: "/api/auth/google",
        body: { idToken: "fake-token" },
      });

      const after = testDb.db
        .prepare("SELECT * FROM users WHERE google_sub = 'placeholder:1'")
        .get() as Record<string, unknown>;
      expect(after).toEqual(before);
      expect(after["name"]).toBe("Bloqueado #1");
    });

    it("el log de rechazo no incluye el email completo", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      verifier.setNextPayload({
        sub: "placeholder:2",
        email: "bloqueado2@teimas.space",
        hd: "teimas.space",
        name: "Bloqueado #2",
        email_verified: true,
      });

      await server.app.inject({
        method: "POST",
        url: "/api/auth/google",
        body: { idToken: "fake-token" },
      });

      const call = warnSpy.mock.calls.find(
        ([msg, meta]) =>
          msg === "auth.rejected" &&
          (meta as { reason?: string } | undefined)?.reason === "placeholder_cannot_login",
      );
      expect(call).toBeDefined();
      expect(JSON.stringify(call)).not.toContain("bloqueado2@teimas.space");
    });

    it("un empleado real con sub numérico se loguea y los placeholders quedan intactos", async () => {
      verifier.setNextPayload({
        sub: "104928374651029384756",
        email: "alice@teimas.com",
        hd: "teimas.com",
        name: "Alice",
        email_verified: true,
      });

      const res = await server.app.inject({
        method: "POST",
        url: "/api/auth/google",
        body: { idToken: "fake-token" },
      });
      expect(res.statusCode).toBe(200);

      const placeholders = testDb.db
        .prepare("SELECT name FROM users WHERE is_placeholder = 1 ORDER BY google_sub")
        .all() as Array<{ name: string }>;
      expect(placeholders.map((p) => p.name)).toEqual([
        "Bloqueado #1",
        "Bloqueado #2",
        "Bloqueado #3",
      ]);
    });
  });

  describe("con TEIMAS_DOMAINS real (sin teimas.space)", () => {
    beforeEach(async () => {
      testDb = setupTestDb();
      verifier = new FakeGoogleVerifier();
      const env = parseEnv({
        SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
        TEIMAS_DOMAINS: "teimas.com,teimas.es",
        ADMIN_EMAILS: "",
      });
      server = await startTestServer({ db: testDb.db, googleVerifier: verifier as never, env });
    });

    it("el dominio del placeholder no está permitido: 403 y sin sesión", async () => {
      verifier.setNextPayload({
        sub: "placeholder:1",
        email: "bloqueado1@teimas.space",
        hd: "teimas.space",
        name: "Bloqueado #1",
        email_verified: true,
      });

      const res = await server.app.inject({
        method: "POST",
        url: "/api/auth/google",
        body: { idToken: "fake-token" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers["set-cookie"]).toBeUndefined();
    });
  });
});
