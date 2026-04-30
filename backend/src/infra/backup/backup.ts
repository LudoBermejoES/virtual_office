import { createReadStream, createWriteStream, chmodSync, mkdirSync, rmSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { filesToDelete } from "./retention.js";

interface BackupEnv {
  VO_BACKUP_DIR?: string;
}

export async function runBackup(db: DatabaseSync, env: BackupEnv): Promise<string> {
  const backupDir = env.VO_BACKUP_DIR ?? "./backups";
  mkdirSync(backupDir, { recursive: true });

  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const tmpPath = join(backupDir, `${ts}.db.tmp`);
  const gzPath = join(backupDir, `${ts}.db.gz`);

  db.exec(`VACUUM INTO '${tmpPath}'`);

  try {
    await pipeline(createReadStream(tmpPath), createGzip(), createWriteStream(gzPath));
  } finally {
    rmSync(tmpPath, { force: true });
  }

  chmodSync(gzPath, 0o600);

  await applyRetention(backupDir);

  return gzPath;
}

async function applyRetention(backupDir: string): Promise<void> {
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(backupDir).filter((f) => f.endsWith(".db.gz"));
  const toDelete = filesToDelete(files, new Date());
  for (const name of toDelete) {
    rmSync(join(backupDir, name), { force: true });
  }
}
