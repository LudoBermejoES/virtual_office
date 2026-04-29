import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set<number>(
    (db.prepare("SELECT version FROM _migrations ORDER BY version").all() as { version: number }[])
      .map((r) => r.version),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split("_")[0]!, 10);
    if (applied.has(version)) continue;

    const sql = readFileSync(join(migrationsDir, file), "utf8");
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (version) VALUES (?)").run(version);
  }
}
