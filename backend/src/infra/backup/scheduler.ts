import cron from "node-cron";
import type { DatabaseSync } from "node:sqlite";
import type { Env } from "../../config/env.js";
import { runBackup } from "./backup.js";
import { logger } from "../../config/logger.js";

export function startBackupScheduler(db: DatabaseSync, env: Env): void {
  const expression = env.VO_BACKUP_CRON ?? "0 3 * * *";
  cron.schedule(expression, () => {
    runBackup(db, env).catch((err: unknown) => logger.error("backup.failed", { error: err }));
  });
}
