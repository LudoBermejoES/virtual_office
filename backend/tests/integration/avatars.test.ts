/**
 * Tests integración de los endpoints de avatares custom (change 030).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb, type TestDb } from "../support/db.js";
import { startTestServer, type TestServer } from "../support/server.js";
import { FakeGoogleVerifier } from "../support/google-auth-fake.js";
import { parseEnv } from "../../src/config/env.js";

function makeTestEnv(mapsDir: string, avatarsDir: string) {
  return parseEnv({
    SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
    TEIMAS_DOMAINS: "teimas.com",
    ADMIN_EMAILS: "alice@teimas.com",
    OFFICE_MAPS_DIR: mapsDir,
    AVATARS_DIR: avatarsDir,
  });
}

async function loginAs(
  server: TestServer,
  verifier: FakeGoogleVerifier,
  email: string,
  sub: string,
  picture: string | null = null,
): Promise<string> {
  const payload: Record<string, unknown> = {
    sub,
    email,
    hd: "teimas.com",
    name: email.split("@")[0],
    iss: "accounts.google.com",
    email_verified: true,
  };
  if (picture !== null) payload["picture"] = picture;
  verifier.setNextPayload(payload as never);
  const res = await server.app.inject({
    method: "POST",
    url: "/api/auth/google",
    body: { idToken: "fake" },
  });
  const cookieHeader = res.headers["set-cookie"];
  const raw = Array.isArray(cookieHeader) ? (cookieHeader[0] ?? "") : String(cookieHeader ?? "");
  return raw.split(";")[0] ?? "";
}

function getUserIdByEmail(testDb: TestDb, email: string): number {
  const row = testDb.db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`user ${email} not found`);
  return row.id;
}

const PNG_BUF = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0),
]);
const JPEG_BUF = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]);
const WEBP_BUF = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "ascii"),
  Buffer.alloc(64, 0),
]);

function multipartBody(fieldName: string, filename: string, contentType: string, buf: Buffer) {
  const boundary = "----TestBoundary" + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf-8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
  return {
    body: Buffer.concat([head, buf, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe("avatars endpoints (change 030)", () => {
  let testDb: TestDb;
  let server: TestServer;
  let verifier: FakeGoogleVerifier;
  let mapsDir: string;
  let avatarsDir: string;
  let aliceCookie: string;
  let bobCookie: string;
  let bobId: number;

  beforeEach(async () => {
    testDb = setupTestDb();
    verifier = new FakeGoogleVerifier();
    mapsDir = mkdtempSync(join(tmpdir(), "vo-avatars-maps-"));
    avatarsDir = mkdtempSync(join(tmpdir(), "vo-avatars-"));
    server = await startTestServer({
      db: testDb.db,
      googleVerifier: verifier as never,
      env: makeTestEnv(mapsDir, avatarsDir),
    });
    aliceCookie = await loginAs(
      server,
      verifier,
      "alice@teimas.com",
      "alice-sub",
      "https://lh3.googleusercontent.com/alice",
    );
    bobCookie = await loginAs(
      server,
      verifier,
      "bob@teimas.com",
      "bob-sub",
      "https://lh3.googleusercontent.com/bob-old",
    );
    bobId = getUserIdByEmail(testDb, "bob@teimas.com");
  });

  afterEach(async () => {
    await server.teardown();
    testDb.cleanup();
    rmSync(mapsDir, { recursive: true, force: true });
    rmSync(avatarsDir, { recursive: true, force: true });
  });

  describe("POST /api/users/:id/avatar", () => {
    it("admin sube PNG → 200, avatar_url /avatars/<id>_<hash>.png, avatar_locked=1", async () => {
      const m = multipartBody("file", "avatar.png", "image/png", PNG_BUF);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ user: { avatar_url: string; avatar_locked: number } }>();
      expect(body.user.avatar_url).toMatch(new RegExp(`^/avatars/${String(bobId)}_[a-f0-9]{8}\\.png$`));
      expect(body.user.avatar_locked).toBe(1);
    });

    it("admin sube WebP válido → 200", async () => {
      const m = multipartBody("file", "avatar.webp", "image/webp", WEBP_BUF);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ user: { avatar_url: string } }>();
      expect(body.user.avatar_url).toMatch(/\.webp$/);
    });

    it("admin sube JPEG válido → 200", async () => {
      const m = multipartBody("file", "avatar.jpg", "image/jpeg", JPEG_BUF);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ user: { avatar_url: string } }>();
      expect(body.user.avatar_url).toMatch(/\.jpg$/);
    });

    it("content-type image/gif → 400 bad_content_type", async () => {
      const m = multipartBody("file", "avatar.gif", "image/gif", PNG_BUF);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ reason: "bad_content_type" });
    });

    it("content-type PNG pero magic bytes JPEG → 400 bad_image", async () => {
      const m = multipartBody("file", "avatar.png", "image/png", JPEG_BUF);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ reason: "bad_image" });
    });

    it("fichero > 1MB → 400 file_too_large", async () => {
      // 1MB + 16 bytes: sobrepasa MAX_AVATAR_BYTES (1MB) pero no el límite
      // global del plugin multipart (2MB).
      const big = Buffer.concat([PNG_BUF, Buffer.alloc(1024 * 1024)]);
      const m = multipartBody("file", "avatar.png", "image/png", big);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ reason: "file_too_large" });
    });

    it("caller no admin → 403", async () => {
      const m = multipartBody("file", "avatar.png", "image/png", PNG_BUF);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: bobCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(403);
    });

    it("user inexistente → 404", async () => {
      const m = multipartBody("file", "avatar.png", "image/png", PNG_BUF);
      const res = await server.app.inject({
        method: "POST",
        url: `/api/users/99999/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ reason: "user_not_found" });
    });

    it("subir nuevo borra el fichero anterior", async () => {
      const m1 = multipartBody("file", "a.png", "image/png", PNG_BUF);
      const r1 = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m1.contentType },
        payload: m1.body,
      });
      const before = r1.json<{ user: { avatar_url: string } }>().user.avatar_url;
      const beforeFilename = before.replace("/avatars/", "");
      expect(existsSync(join(avatarsDir, beforeFilename))).toBe(true);

      const m2 = multipartBody("file", "b.png", "image/png", PNG_BUF);
      const r2 = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m2.contentType },
        payload: m2.body,
      });
      expect(r2.statusCode).toBe(200);
      expect(existsSync(join(avatarsDir, beforeFilename))).toBe(false);
      const files = readdirSync(avatarsDir);
      expect(files).toHaveLength(1);
    });
  });

  describe("DELETE /api/users/:id/avatar", () => {
    it("admin resetea avatar custom → 200, avatar_url=null, locked=0, fichero borrado", async () => {
      const m = multipartBody("file", "a.png", "image/png", PNG_BUF);
      const r1 = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      const beforeUrl = r1.json<{ user: { avatar_url: string } }>().user.avatar_url;
      const filename = beforeUrl.replace("/avatars/", "");

      const res = await server.app.inject({
        method: "DELETE",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ user: { avatar_url: null; avatar_locked: number } }>();
      expect(body.user.avatar_url).toBeNull();
      expect(body.user.avatar_locked).toBe(0);
      expect(existsSync(join(avatarsDir, filename))).toBe(false);
    });

    it("DELETE idempotente cuando no había override", async () => {
      const res = await server.app.inject({
        method: "DELETE",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ user: { avatar_url: string | null; avatar_locked: number } }>();
      // No tocó: sigue con avatar de Google.
      expect(body.user.avatar_url).toBe("https://lh3.googleusercontent.com/bob-old");
      expect(body.user.avatar_locked).toBe(0);
    });
  });

  describe("GET /avatars/:filename", () => {
    it("filename válido → 200 con cache immutable", async () => {
      const m = multipartBody("file", "a.png", "image/png", PNG_BUF);
      const r1 = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      const url = r1.json<{ user: { avatar_url: string } }>().user.avatar_url;

      const res = await server.app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toMatch(/immutable/);
      expect(res.headers["content-type"]).toBe("image/png");
    });

    it("filename inválido → 400 bad_filename", async () => {
      const res = await server.app.inject({
        method: "GET",
        url: "/avatars/..%2Fetc%2Fpasswd",
      });
      expect(res.statusCode).toBe(400);
    });

    it("filename con formato pero fichero inexistente → 404", async () => {
      const res = await server.app.inject({
        method: "GET",
        url: "/avatars/42_aabbccdd.png",
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("login regression (change 030)", () => {
    it("avatar_locked=1 NO se machaca al re-loguear con picture nuevo", async () => {
      const m = multipartBody("file", "a.png", "image/png", PNG_BUF);
      const r1 = await server.app.inject({
        method: "POST",
        url: `/api/users/${bobId}/avatar`,
        headers: { cookie: aliceCookie, "content-type": m.contentType },
        payload: m.body,
      });
      const customUrl = r1.json<{ user: { avatar_url: string } }>().user.avatar_url;

      // Bob se vuelve a loguear con picture distinto.
      await loginAs(
        server,
        verifier,
        "bob@teimas.com",
        "bob-sub",
        "https://lh3.googleusercontent.com/bob-NUEVO",
      );

      const row = testDb.db
        .prepare("SELECT avatar_url, avatar_locked FROM users WHERE id = ?")
        .get(bobId) as { avatar_url: string; avatar_locked: number };
      expect(row.avatar_url).toBe(customUrl);
      expect(row.avatar_locked).toBe(1);
    });

    it("avatar_locked=0 sí actualiza desde Google al re-loguear", async () => {
      // Estado inicial: bob tiene picture de Google (bob-old).
      await loginAs(
        server,
        verifier,
        "bob@teimas.com",
        "bob-sub",
        "https://lh3.googleusercontent.com/bob-NUEVO-2",
      );
      const row = testDb.db
        .prepare("SELECT avatar_url, avatar_locked FROM users WHERE id = ?")
        .get(bobId) as { avatar_url: string; avatar_locked: number };
      expect(row.avatar_url).toBe("https://lh3.googleusercontent.com/bob-NUEVO-2");
      expect(row.avatar_locked).toBe(0);
    });
  });
});
