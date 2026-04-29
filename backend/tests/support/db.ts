import type { DatabaseSync } from "node:sqlite";
import { openDb } from "../../src/infra/db/sqlite.js";
import { runMigrations } from "../../src/infra/db/migrations.js";

export interface TestDb {
  db: DatabaseSync;
  cleanup: () => void;
}

export function setupTestDb(): TestDb {
  const db = openDb(":memory:");
  runMigrations(db);

  return {
    db,
    cleanup: () => db.close(),
  };
}
