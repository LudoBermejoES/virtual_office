import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initSentry } from "./infra/observability/sentry.js";
import { openDb } from "./infra/db/sqlite.js";
import { runMigrations } from "./infra/db/migrations.js";
import { buildServer } from "./http/server.js";
import { startBackupScheduler } from "./infra/backup/scheduler.js";

async function main(): Promise<void> {
  initSentry();

  const db = openDb(env.DB_PATH);
  runMigrations(db);
  logger.info("Migraciones aplicadas");

  const server = await buildServer({ db, env });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Señal recibida: ${signal}. Cerrando servidor...`);
    await server.close();
    db.close();
    logger.info("Servidor cerrado correctamente");
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info("Servidor arrancado", { port: env.PORT });
  startBackupScheduler(db, env);
}

main().catch((err: unknown) => {
  process.stderr.write(`Error fatal al arrancar: ${String(err)}\n`);
  process.exit(1);
});
