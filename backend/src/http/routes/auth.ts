import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { isAllowedDomain } from "../../domain/auth.js";
import type { GoogleVerifier } from "../../infra/auth/google-verifier.js";
import { signJwt, verifyJwt } from "../../infra/auth/session.js";
import { upsertUser, promoteToAdmin, findUserById } from "../../infra/repos/users.js";
import { logger } from "../../config/logger.js";
import type { Env } from "../../config/env.js";

const COOKIE_NAME = "session";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: false, // se activa en producción vía Fastify
  sameSite: "lax" as const,
  path: "/",
};

export async function authRoutes(
  app: FastifyInstance,
  {
    db,
    googleVerifier,
    env,
  }: { db: DatabaseSync; googleVerifier: GoogleVerifier | undefined; env: Env },
): Promise<void> {
  const allowedDomains = env.TEIMAS_DOMAINS.split(",").map((d) => d.trim());
  const adminEmails = env.ADMIN_EMAILS ? env.ADMIN_EMAILS.split(",").map((e) => e.trim()) : [];

  // POST /api/auth/google
  app.post(
    "/api/auth/google",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const body = z.object({ idToken: z.string() }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ reason: "bad_request" });

      let payload: Awaited<ReturnType<NonNullable<typeof googleVerifier>["verify"]>>;
      try {
        if (!googleVerifier) throw new Error("GoogleVerifier no configurado");
        payload = await googleVerifier.verify(body.data.idToken);
      } catch {
        logger.warn("auth.rejected", { reason: "invalid_token" });
        return reply.status(401).send({ reason: "invalid_token" });
      }

      if (!payload.email_verified) {
        logger.warn("auth.rejected", { reason: "email_not_verified" });
        return reply.status(403).send({ reason: "email_not_verified" });
      }

      if (!isAllowedDomain(payload.hd, payload.email, allowedDomains)) {
        logger.warn("auth.rejected", { reason: "domain_not_allowed" });
        return reply.status(403).send({ reason: "domain_not_allowed" });
      }

      const domain = payload.email.split("@")[1] ?? "";
      const role = adminEmails.includes(payload.email) ? "admin" : "member";
      const user = upsertUser(db, {
        google_sub: payload.sub,
        email: payload.email,
        domain,
        name: payload.name,
        avatar_url: payload.picture,
        role,
      });

      if (adminEmails.includes(user.email) && user.role !== "admin") {
        promoteToAdmin(db, user.email);
        user.role = "admin";
      }

      const token = await signJwt(
        { sub: user.id, role: user.role, kid: 1 },
        env.SESSION_SECRET,
        env.SESSION_TTL_DAYS,
      );

      const maxAge = env.SESSION_TTL_DAYS * 24 * 3600;
      logger.info("auth.success", { domain });
      return reply
        .setCookie(COOKIE_NAME, token, { ...COOKIE_OPTS, maxAge })
        .status(200)
        .send({ id: user.id, email: user.email, name: user.name, role: user.role });
    },
  );

  // GET /api/me
  app.get("/api/me", async (request, reply) => {
    const token = request.cookies[COOKIE_NAME];
    if (!token) return reply.status(401).send({ reason: "no_session" });

    let sessionPayload: Awaited<ReturnType<typeof verifyJwt>>;
    try {
      sessionPayload = await verifyJwt(
        token,
        env.SESSION_SECRET,
        env.SESSION_SECRET_PREVIOUS || undefined,
      );
    } catch {
      return reply.status(401).send({ reason: "invalid_session" });
    }

    const user = findUserById(db, sessionPayload.sub);
    if (!user) return reply.status(401).send({ reason: "user_not_found" });

    return reply.status(200).send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatar_url,
    });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", async (_request, reply) => {
    return reply
      .setCookie(COOKIE_NAME, "", { ...COOKIE_OPTS, maxAge: 0 })
      .status(204)
      .send();
  });
}
