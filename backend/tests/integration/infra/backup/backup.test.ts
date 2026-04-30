import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { runBackup } from "../../../../src/infra/backup/backup.js";

describe("runBackup", () => {
  let backupDir: string;
  let db: DatabaseSync;

  beforeAll(() => {
    backupDir = join(tmpdir(), `vo-backup-test-${Date.now()}`);
    mkdirSync(backupDir, { recursive: true });
    db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE test_table (id INTEGER PRIMARY KEY, val TEXT)");
    db.exec("INSERT INTO test_table VALUES (1, 'hello')");
  });

  afterAll(() => {
    db.close();
    rmSync(backupDir, { recursive: true, force: true });
  });

  it("produce un fichero .db.gz con permisos 600 que se puede descomprimir a una DB SQLite válida", async () => {
    const gzPath = await runBackup(db, { VO_BACKUP_DIR: backupDir });

    // Existe el fichero
    expect(existsSync(gzPath)).toBe(true);

    // Nombre con patrón YYYY-MM-DD-HHmm.db.gz
    const filename = gzPath.split("/").pop()!;
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}\.db\.gz$/);

    // Permisos 600
    const mode = statSync(gzPath).mode & 0o777;
    expect(mode).toBe(0o600);

    // Descomprimible a una DB SQLite válida
    const extractedPath = gzPath.replace(".db.gz", ".db.extracted");
    await pipeline(
      createReadStream(gzPath),
      createGunzip(),
      createWriteStream(extractedPath),
    );
    const restored = new DatabaseSync(extractedPath);
    const rows = restored.prepare("SELECT val FROM test_table").all() as { val: string }[];
    restored.close();
    rmSync(extractedPath);

    expect(rows).toHaveLength(1);
    expect(rows[0].val).toBe("hello");
  });

  it("no deja fichero .db.tmp tras el backup", async () => {
    await runBackup(db, { VO_BACKUP_DIR: backupDir });
    const files = readdirSync(backupDir);
    const tmpFiles = files.filter((f) => f.endsWith(".db.tmp"));
    expect(tmpFiles).toHaveLength(0);
  });
});
