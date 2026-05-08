import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, type TestDb } from "../../support/db.js";
import { upsertUser, setAvatarLocked, findUserById } from "../../../src/infra/repos/users.js";

describe("users repo — avatar_locked (change 030)", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("migración 0009 añade columna avatar_locked con default 0", () => {
    const u = upsertUser(testDb.db, {
      google_sub: "g1",
      email: "alice@teimas.com",
      domain: "teimas.com",
      name: "Alice",
      avatar_url: "https://lh3.googleusercontent.com/old",
      role: "member",
    });
    expect(u.avatar_locked).toBe(0);
  });

  it("upsert con avatar_locked=1 NO sobrescribe avatar_url al re-loguear", () => {
    const u = upsertUser(testDb.db, {
      google_sub: "g1",
      email: "alice@teimas.com",
      domain: "teimas.com",
      name: "Alice",
      avatar_url: "https://lh3.googleusercontent.com/old",
      role: "member",
    });
    setAvatarLocked(testDb.db, u.id, "/avatars/1_aaaaaaaa.png", 1);

    // Simulamos un nuevo login con picture distinto.
    const u2 = upsertUser(testDb.db, {
      google_sub: "g1",
      email: "alice@teimas.com",
      domain: "teimas.com",
      name: "Alice Nueva",
      avatar_url: "https://lh3.googleusercontent.com/new",
      role: "member",
    });
    expect(u2.avatar_url).toBe("/avatars/1_aaaaaaaa.png");
    expect(u2.avatar_locked).toBe(1);
    // El nombre sí se actualiza.
    expect(u2.name).toBe("Alice Nueva");
  });

  it("upsert con avatar_locked=0 SÍ actualiza avatar_url (regresión existente)", () => {
    upsertUser(testDb.db, {
      google_sub: "g1",
      email: "alice@teimas.com",
      domain: "teimas.com",
      name: "Alice",
      avatar_url: "https://lh3.googleusercontent.com/old",
      role: "member",
    });
    const u2 = upsertUser(testDb.db, {
      google_sub: "g1",
      email: "alice@teimas.com",
      domain: "teimas.com",
      name: "Alice",
      avatar_url: "https://lh3.googleusercontent.com/new",
      role: "member",
    });
    expect(u2.avatar_url).toBe("https://lh3.googleusercontent.com/new");
    expect(u2.avatar_locked).toBe(0);
  });

  it("setAvatarLocked actualiza ambos campos atómicamente", () => {
    const u = upsertUser(testDb.db, {
      google_sub: "g1",
      email: "alice@teimas.com",
      domain: "teimas.com",
      name: "Alice",
      avatar_url: null,
      role: "member",
    });
    setAvatarLocked(testDb.db, u.id, "/avatars/1_xxxx.webp", 1);
    const after = findUserById(testDb.db, u.id)!;
    expect(after.avatar_url).toBe("/avatars/1_xxxx.webp");
    expect(after.avatar_locked).toBe(1);

    setAvatarLocked(testDb.db, u.id, null, 0);
    const after2 = findUserById(testDb.db, u.id)!;
    expect(after2.avatar_url).toBeNull();
    expect(after2.avatar_locked).toBe(0);
  });
});
