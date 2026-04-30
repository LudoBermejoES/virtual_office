import { describe, it, expect } from "vitest";
import { setupTestDb } from "../support/db.js";
import { runMigrations } from "../../src/infra/db/migrations.js";

describe("migración 0004_office_features", () => {
  it("aplica de forma idempotente sobre una DB existente", () => {
    const { db, cleanup } = setupTestDb();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='office_features'")
      .all() as { name: string }[];
    expect(tables).toHaveLength(1);

    const cols = db.prepare("PRAGMA table_info(office_features)").all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("office_id");
    expect(colNames).toContain("kind");
    expect(colNames).toContain("name");
    expect(colNames).toContain("geometry_json");
    expect(colNames).toContain("properties_json");
    expect(colNames).toContain("ordinal");

    // Segunda ejecución es idempotente
    expect(() => runMigrations(db)).not.toThrow();

    cleanup();
  });
});
