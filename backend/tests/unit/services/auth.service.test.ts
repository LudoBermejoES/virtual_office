import { describe, it, expect } from "vitest";
import { setupTestDb } from "../../support/db.js";
import { canAdminOffice } from "../../../src/services/auth.service.js";

function makeOffice(db: ReturnType<typeof setupTestDb>["db"], name = "Oficina") {
  db.prepare(
    "INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?,?,?,?,?,?,?,?)",
  ).run(name, "map.tmj", 32, 32, 10, 10, 320, 320);
  return (db.prepare("SELECT id FROM offices WHERE name=?").get(name) as { id: number }).id;
}

function makeUser(
  db: ReturnType<typeof setupTestDb>["db"],
  email: string,
  role: "admin" | "member",
) {
  db.prepare(
    "INSERT INTO users (google_sub, email, domain, name, role) VALUES (?,?,?,?,?)",
  ).run(`sub-${email}`, email, "test.com", email, role);
  return (db.prepare("SELECT id FROM users WHERE email=?").get(email) as { id: number }).id;
}

// 2.1 — super-admin devuelve true para cualquier oficina
describe("canAdminOffice — super-admin", () => {
  it("admin global puede adminear cualquier oficina", () => {
    const { db, cleanup } = setupTestDb();
    const officeId = makeOffice(db, "O1");
    const userId = makeUser(db, "admin@test.com", "admin");

    expect(canAdminOffice({ id: userId, role: "admin" }, officeId, db)).toBe(true);
    cleanup();
  });

  it("admin global puede adminear una oficina en la que no está en office_admins", () => {
    const { db, cleanup } = setupTestDb();
    const officeId = makeOffice(db);
    const userId = makeUser(db, "admin2@test.com", "admin");

    expect(canAdminOffice({ id: userId, role: "admin" }, officeId + 999, db)).toBe(true);
    cleanup();
  });
});

// 2.2 — office-admin tiene acceso solo a su oficina
describe("canAdminOffice — office-admin", () => {
  it("office-admin de X devuelve true para X", () => {
    const { db, cleanup } = setupTestDb();
    const office1 = makeOffice(db, "A");
    const userId = makeUser(db, "oadmin@test.com", "member");

    db.prepare("INSERT INTO office_admins (office_id, user_id) VALUES (?, ?)").run(office1, userId);

    expect(canAdminOffice({ id: userId, role: "member" }, office1, db)).toBe(true);
    cleanup();
  });

  it("office-admin de X devuelve false para Y", () => {
    const { db, cleanup } = setupTestDb();
    const office1 = makeOffice(db, "A2");
    const office2 = makeOffice(db, "B2");
    const userId = makeUser(db, "oadmin2@test.com", "member");

    db.prepare("INSERT INTO office_admins (office_id, user_id) VALUES (?, ?)").run(office1, userId);

    expect(canAdminOffice({ id: userId, role: "member" }, office2, db)).toBe(false);
    cleanup();
  });
});

// 2.3 — member sin office_admins siempre false
describe("canAdminOffice — member sin permisos", () => {
  it("member sin entrada en office_admins devuelve false", () => {
    const { db, cleanup } = setupTestDb();
    const officeId = makeOffice(db);
    const userId = makeUser(db, "member@test.com", "member");

    expect(canAdminOffice({ id: userId, role: "member" }, officeId, db)).toBe(false);
    cleanup();
  });
});
