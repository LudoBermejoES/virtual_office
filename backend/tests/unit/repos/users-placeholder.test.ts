import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, type TestDb } from "../../support/db.js";
import {
  listUsers,
  findUserByEmail,
  isPlaceholder,
  upsertUser,
} from "../../../src/infra/repos/users.js";

/** Change 031: visibilidad selectiva de los placeholders en el repo. */
describe("users repo — placeholders (change 031)", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
    upsertUser(testDb.db, {
      google_sub: "g-alice",
      email: "alice@teimas.com",
      domain: "teimas.com",
      name: "Alice",
      role: "member",
    });
    upsertUser(testDb.db, {
      google_sub: "g-bob",
      email: "bob@teimas.com",
      domain: "teimas.com",
      name: "Bob",
      role: "admin",
    });
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("listUsers excluye los placeholders por defecto", () => {
    const users = listUsers(testDb.db);
    expect(users).toHaveLength(2);
    expect(users.every((u) => u.is_placeholder === 0)).toBe(true);
    expect(users.map((u) => u.name).sort()).toEqual(["Alice", "Bob"]);
  });

  it("listUsers con includePlaceholders los devuelve al final del array", () => {
    const users = listUsers(testDb.db, { includePlaceholders: true });
    expect(users).toHaveLength(5);

    const reales = users.slice(0, 2);
    const placeholders = users.slice(2);
    expect(reales.every((u) => u.is_placeholder === 0)).toBe(true);
    expect(placeholders.every((u) => u.is_placeholder === 1)).toBe(true);
    expect(placeholders.map((u) => u.name)).toEqual([
      "Bloqueado #1",
      "Bloqueado #2",
      "Bloqueado #3",
    ]);
  });

  it("el orden de los placeholders es estable aunque compartan created_at", () => {
    // El seed de la migración los inserta en un solo INSERT, así que los tres
    // comparten `created_at` al segundo y `ORDER BY created_at` deja el orden
    // indefinido. El desempate por `id` lo hace determinista.
    testDb.db
      .prepare("UPDATE users SET created_at = '2026-01-01 00:00:00' WHERE is_placeholder = 1")
      .run();

    const placeholders = listUsers(testDb.db, { includePlaceholders: true }).filter(
      (u) => u.is_placeholder === 1,
    );
    expect(placeholders.map((u) => u.name)).toEqual([
      "Bloqueado #1",
      "Bloqueado #2",
      "Bloqueado #3",
    ]);
    expect(placeholders.map((u) => u.id)).toEqual(
      [...placeholders.map((u) => u.id)].sort((a, b) => a - b),
    );
  });

  it("findUserByEmail encuentra un placeholder por su email sintético", () => {
    const u = findUserByEmail(testDb.db, "bloqueado1@teimas.space");
    expect(u).not.toBeNull();
    expect(u!.is_placeholder).toBe(1);
    expect(u!.name).toBe("Bloqueado #1");
  });

  it("isPlaceholder devuelve true solo con is_placeholder = 1", () => {
    const placeholder = findUserByEmail(testDb.db, "bloqueado2@teimas.space")!;
    const real = findUserByEmail(testDb.db, "alice@teimas.com")!;
    expect(isPlaceholder(placeholder)).toBe(true);
    expect(isPlaceholder(real)).toBe(false);
  });

  it("UserRow expone is_placeholder como número", () => {
    const real = findUserByEmail(testDb.db, "alice@teimas.com")!;
    expect(real.is_placeholder).toBe(0);
  });
});
