import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { verifyJwt } from "../../infra/auth/session.js";
import { findUserById } from "../../infra/repos/users.js";
import { findOfficeById } from "../../infra/repos/offices.js";
import { officeRoom } from "../../infra/ws/hub.js";
import type { WsHub } from "../../infra/ws/hub.js";
import type { Env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

const HEARTBEAT_TIMEOUT_MS = 60_000;

export async function occupancyWsRoutes(
  app: FastifyInstance,
  { db, env, hub }: { db: DatabaseSync; env: Env; hub: WsHub },
): Promise<void> {
  app.get<{ Params: { id: string } }>(
    "/ws/offices/:id",
    { websocket: true },
    (connection, request) => {
      const socket = connection;

      const cookies = request.cookies;
      const token = cookies?.session;
      if (!token) {
        socket.close(4001, "no_session");
        return;
      }

      let userId: number;
      void (async () => {
        try {
          const payload = await verifyJwt(
            token,
            env.SESSION_SECRET,
            env.SESSION_SECRET_PREVIOUS || undefined,
          );
          userId = payload.sub;
        } catch {
          socket.close(4001, "invalid_session");
          return;
        }

        const user = findUserById(db, userId);
        if (!user) {
          socket.close(4001, "user_not_found");
          return;
        }

        const officeId = Number(request.params.id);
        if (!Number.isInteger(officeId) || officeId <= 0) {
          socket.close(4400, "bad_request");
          return;
        }
        const office = findOfficeById(db, officeId);
        if (!office) {
          socket.close(4404, "office_not_found");
          return;
        }

        const room = officeRoom(officeId);
        hub.join(room, socket as unknown as Parameters<typeof hub.join>[1]);

        try {
          socket.send(JSON.stringify({ type: "snapshot.ts", at: new Date().toISOString() }));
        } catch {
          // El socket pudo cerrarse antes de enviar el primer mensaje
        }

        let idleTimer = setTimeout(() => socket.close(4002, "idle"), HEARTBEAT_TIMEOUT_MS);

        socket.on("message", (raw: Buffer) => {
          try {
            const msg = JSON.parse(raw.toString()) as { type?: string };
            if (msg.type === "ping") {
              clearTimeout(idleTimer);
              idleTimer = setTimeout(() => socket.close(4002, "idle"), HEARTBEAT_TIMEOUT_MS);
            }
          } catch {
            // mensajes malformados se ignoran
          }
        });

        socket.on("close", () => {
          clearTimeout(idleTimer);
          hub.leave(room, socket as unknown as Parameters<typeof hub.leave>[1]);
          logger.info("ws.disconnected", { officeId, userId });
        });

        logger.info("ws.connected", { officeId, userId });
      })();
    },
  );
}
