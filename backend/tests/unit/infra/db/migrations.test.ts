import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../../../../src/infra/db/migrations.js";

function openMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

describe("runMigrations", () => {
  it("aplica la migración inicial y registra la versión en _migrations", () => {
    const db = openMemoryDb();
    runMigrations(db);

    const rows = db
      .prepare("SELECT version FROM _migrations ORDER BY version")
      .all() as { version: number }[];

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.version).toBe(1);
  });

  it("es idempotente: aplicar dos veces no duplica registros", () => {
    const db = openMemoryDb();
    runMigrations(db);
    runMigrations(db);

    const rows = db
      .prepare("SELECT version FROM _migrations ORDER BY version")
      .all() as { version: number }[];

    const versions = rows.map((r) => r.version);
    const unique = new Set(versions);
    expect(versions.length).toBe(unique.size);
  });

  it("crea las tablas definidas en 0001_init.sql", () => {
    const db = openMemoryDb();
    runMigrations(db);

    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[]
    ).map((r) => r.name);

    for (const t of ["users", "offices", "desks", "bookings", "invitations", "_migrations"]) {
      expect(tables).toContain(t);
    }
  });
});
