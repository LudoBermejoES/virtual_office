import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "../support/db.js";
import type { TestDb } from "../support/db.js";

/**
 * Change 031: migración 0010_placeholder_users.sql.
 *
 * Añade `users.is_placeholder` y siembra tres filas `Bloqueado #1..#3`. Al ser
 * filas de `users` ordinarias respetan las reglas de unicidad existentes sin
 * modificar ningún índice (ver design.md decisión 1).
 */
describe("migración 0010 placeholder users", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("añade la columna is_placeholder con DEFAULT 0", () => {
    const cols = testDb.db.prepare("PRAGMA table_info(users)").all() as Array<{
      name: string;
      dflt_value: string | null;
      notnull: number;
    }>;
    const col = cols.find((c) => c.name === "is_placeholder");
    expect(col).toBeDefined();
    expect(col!.notnull).toBe(1);
    expect(col!.dflt_value).toBe("0");
  });

  it("siembra exactamente tres placeholders con name y google_sub esperados", () => {
    const rows = testDb.db
      .prepare(
        "SELECT google_sub, email, domain, name, role, is_invited_external FROM users WHERE is_placeholder = 1 ORDER BY google_sub",
      )
      .all() as Array<{
      google_sub: string;
      email: string;
      domain: string;
      name: string;
      role: string;
      is_invited_external: number;
    }>;

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(["Bloqueado #1", "Bloqueado #2", "Bloqueado #3"]);
    expect(rows.map((r) => r.google_sub)).toEqual([
      "placeholder:1",
      "placeholder:2",
      "placeholder:3",
    ]);
    for (const r of rows) {
      expect(r.role).toBe("member");
      expect(r.is_invited_external).toBe(0);
      expect(r.domain).toBe("teimas.space");
      expect(r.email).toMatch(/^bloqueado[123]@teimas\.space$/);
    }
  });

  it("los usuarios reales preexistentes quedan con is_placeholder = 0", () => {
    testDb.db
      .prepare(
        `INSERT INTO users (google_sub, email, domain, name, role, is_invited_external) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("sub-real", "alice@teimas.com", "teimas.com", "Alice", "member", 0);

    const row = testDb.db
      .prepare("SELECT is_placeholder FROM users WHERE google_sub = 'sub-real'")
      .get() as { is_placeholder: number };
    expect(row.is_placeholder).toBe(0);
  });

  it("el seed es idempotente: re-ejecutarlo no duplica ni lanza error de unicidad", () => {
    const seed = `INSERT OR IGNORE INTO users
        (google_sub, email, domain, name, role, is_invited_external, is_placeholder)
      VALUES
        ('placeholder:1', 'bloqueado1@teimas.space', 'teimas.space', 'Bloqueado #1', 'member', 0, 1),
        ('placeholder:2', 'bloqueado2@teimas.space', 'teimas.space', 'Bloqueado #2', 'member', 0, 1),
        ('placeholder:3', 'bloqueado3@teimas.space', 'teimas.space', 'Bloqueado #3', 'member', 0, 1);`;

    expect(() => testDb.db.exec(seed)).not.toThrow();

    const count = testDb.db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE is_placeholder = 1")
      .get() as { n: number };
    expect(count.n).toBe(3);
  });

  it("crea el índice parcial idx_users_is_placeholder", () => {
    const idx = testDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_is_placeholder'")
      .get() as { name: string } | undefined;
    expect(idx).toBeDefined();
  });

  it("NO modifica los índices de unicidad de bookings ni weekly_assignments", () => {
    // El valor de este change está en no tocar estas garantías (design.md
    // decisión 1). Si alguien las relaja, este test lo detecta.
    const dailyIdx = testDb.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_bookings_user_date_daily'",
      )
      .get() as { sql: string } | undefined;
    expect(dailyIdx).toBeDefined();
    expect(dailyIdx!.sql).toContain("type='daily'");

    const weeklyTbl = testDb.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='weekly_assignments'")
      .get() as { sql: string };
    expect(weeklyTbl.sql).toContain("UNIQUE (user_id, dow)");
  });
});
