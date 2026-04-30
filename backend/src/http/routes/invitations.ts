import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { generateInviteToken } from "../../domain/invitations.js";
import * as invRepo from "../../infra/repos/invitations.js";
import { logger } from "../../config/logger.js";
import type { Env } from "../../config/env.js";

export async function invitationsRoutes(
  app: FastifyInstance,
  { db, env }: { db: DatabaseSync; env: Env },
): Promise<void> {
  const teimasDomains = env.TEIMAS_DOMAINS.split(",").map((d) => d.trim());

  app.post("/api/invitations", { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = z.object({ email: z.string().email() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ reason: "bad_request" });

    const email = body.data.email.toLowerCase();
    const domain = email.split("@")[1] ?? "";
    if (teimasDomains.includes(domain)) {
      return reply.status(422).send({ reason: "internal_domain" });
    }

    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
      | { id: number }
      | undefined;
    if (existingUser) return reply.status(409).send({ reason: "already_user" });

    const token = generateInviteToken();
    const expiresAt = new Date(
      Date.now() + env.INVITATION_TTL_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const adminId = request.user!.id;

    const existingInv = invRepo.findByEmail(db, email);
    const row = existingInv
      ? invRepo.renew(db, { email, token, expires_at: expiresAt, invited_by_user_id: adminId })
      : invRepo.create(db, { email, invited_by_user_id: adminId, token, expires_at: expiresAt });

    const event = existingInv ? "invitation.renewed" : "invitation.created";
    logger.info(event, {
      invitedBy: adminId,
      emailDomain: domain,
      tokenPrefix: token.slice(0, 6),
    });

    return reply.status(201).send({
      id: row.id,
      email: row.email,
      token: row.token,
      expires_at: row.expires_at,
      url: `${env.PUBLIC_BASE_URL}/invite/${row.token}`,
    });
  });

  app.get("/api/invitations", { preHandler: app.requireAdmin }, async (request, reply) => {
    const query = z.object({ include: z.enum(["all"]).optional() }).safeParse(request.query);
    const includeAll = query.success && query.data.include === "all";

    const rows = includeAll ? invRepo.listAll(db) : invRepo.listLive(db, new Date());
    return reply.status(200).send(rows);
  });

  app.delete("/api/invitations/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ reason: "bad_request" });

    invRepo.revoke(db, params.data.id, new Date().toISOString());
    return reply.status(204).send();
  });

  app.post(
    "/api/invitations/:id/renew",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
      if (!params.success) return reply.status(400).send({ reason: "bad_request" });

      const existing = invRepo.findById(db, params.data.id);
      if (!existing) return reply.status(404).send({ reason: "not_found" });

      const token = generateInviteToken();
      const expiresAt = new Date(
        Date.now() + env.INVITATION_TTL_DAYS * 24 * 3600 * 1000,
      ).toISOString();

      const updated = invRepo.renewById(db, params.data.id, { token, expires_at: expiresAt });
      logger.info("invitation.renewed_by_id", {
        id: params.data.id,
        tokenPrefix: token.slice(0, 6),
      });

      return reply.status(200).send({ invitation: updated });
    },
  );
}
