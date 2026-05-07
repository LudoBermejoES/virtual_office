import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupTestDb, type TestDb } from "../support/db.js";
import { migrateTmjFilenames } from "../../src/infra/storage/migrate-tmj-filenames.js";

function insertOffice(testDb: TestDb, name: string, tmj_filename: string): number {
  const stmt = testDb.db.prepare(
    `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height)
     VALUES (?, ?, 32, 32, 10, 10, 320, 320)`,
  );
  const result = stmt.run(name, tmj_filename);
  return Number(result.lastInsertRowid);
}

describe("migrateTmjFilenames", () => {
  let baseDir: string;
  let testDb: TestDb;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "vo-migrate-tmj-"));
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("renombra map_<hash>.tmj a map.tmj y actualiza la fila", () => {
    const officeId = insertOffice(testDb, "ofi", "map_abc123def456.tmj");
    const dir = join(baseDir, String(officeId));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "map_abc123def456.tmj"), '{"layers":[]}');

    const result = migrateTmjFilenames(testDb.db, baseDir);

    expect(result.migrated).toBe(1);
    expect(result.alreadyStable).toBe(0);
    expect(existsSync(join(dir, "map.tmj"))).toBe(true);
    expect(existsSync(join(dir, "map_abc123def456.tmj"))).toBe(false);

    const row = testDb.db.prepare("SELECT tmj_filename FROM offices WHERE id=?").get(officeId) as {
      tmj_filename: string;
    };
    expect(row.tmj_filename).toBe("map.tmj");
    expect(readFileSync(join(dir, "map.tmj"), "utf8")).toBe('{"layers":[]}');
  });

  it("idempotente: ejecutar dos veces deja el mismo estado", () => {
    const officeId = insertOffice(testDb, "ofi", "map_abc123.tmj");
    const dir = join(baseDir, String(officeId));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "map_abc123.tmj"), "{}");

    migrateTmjFilenames(testDb.db, baseDir);
    const second = migrateTmjFilenames(testDb.db, baseDir);

    expect(second.migrated).toBe(0);
    expect(second.alreadyStable).toBe(1);
  });

  it("oficina ya con map.tmj se cuenta como alreadyStable", () => {
    insertOffice(testDb, "ofi", "map.tmj");
    const result = migrateTmjFilenames(testDb.db, baseDir);
    expect(result.alreadyStable).toBe(1);
    expect(result.migrated).toBe(0);
  });

  it("oficina sin fichero en disco: actualiza la fila si existe map.tmj, si no lo cuenta como missingFile", () => {
    const officeId = insertOffice(testDb, "ofi", "map_xyz.tmj");
    const dir = join(baseDir, String(officeId));
    mkdirSync(dir, { recursive: true });
    // No existe ningún fichero
    const r1 = migrateTmjFilenames(testDb.db, baseDir);
    expect(r1.missingFile).toBe(1);
    const row = testDb.db.prepare("SELECT tmj_filename FROM offices WHERE id=?").get(officeId) as {
      tmj_filename: string;
    };
    expect(row.tmj_filename).toBe("map_xyz.tmj");

    // Ahora aparece map.tmj (caso edge: alguien lo recreó manualmente)
    writeFileSync(join(dir, "map.tmj"), "{}");
    const r2 = migrateTmjFilenames(testDb.db, baseDir);
    expect(r2.migrated).toBe(1);
    const row2 = testDb.db.prepare("SELECT tmj_filename FROM offices WHERE id=?").get(officeId) as {
      tmj_filename: string;
    };
    expect(row2.tmj_filename).toBe("map.tmj");
  });
});
