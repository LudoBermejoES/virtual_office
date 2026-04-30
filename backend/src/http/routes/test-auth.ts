import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { signJwt } from "../../infra/auth/session.js";
import type { Env } from "../../config/env.js";

const TestSessionBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "external"]),
});

const COOKIE_NAME = "session";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  path: "/",
};

export async function testAuthRoutes(
  app: FastifyInstance,
  { db, env }: { db: DatabaseSync; env: Env },
): Promise<void> {
  app.post("/session", async (request, reply) => {
    const parsed = TestSessionBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ reason: "bad_request" });
    }

    const { email, role } = parsed.data;
    const domain = email.split("@")[1] ?? "example.com";
    const isExternal = role === "external" ? 1 : 0;
    const jwtRole = role === "admin" ? "admin" : "member";

    const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
      | { id: number; email: string; role: string }
      | undefined;

    let userId: number;
    let userRole: "admin" | "member";

    if (existing) {
      userId = existing.id;
      if (role === "admin" && existing.role !== "admin") {
        db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
        userRole = "admin";
      } else {
        userRole = existing.role as "admin" | "member";
      }
    } else {
      const googleSub = `test-${email}`;
      const name = email.split("@")[0] ?? email;
      db.prepare(
        `INSERT INTO users (google_sub, email, domain, name, avatar_url, role, is_invited_external)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      ).run(googleSub, email, domain, name, jwtRole, isExternal);

      const created = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as {
        id: number;
      };
      userId = created.id;
      userRole = jwtRole;
    }

    const token = await signJwt(
      { sub: userId, role: userRole, kid: 1 },
      env.SESSION_SECRET,
      env.SESSION_TTL_DAYS,
    );

    const maxAge = env.SESSION_TTL_DAYS * 24 * 3600;
    return reply
      .setCookie(COOKIE_NAME, token, { ...COOKIE_OPTS, maxAge })
      .status(200)
      .send({ id: userId, email, role: userRole });
  });
}
