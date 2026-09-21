import { describe, it, expect } from "vitest";
import { setupTestDb } from "../support/db.js";

describe("aislamiento de setupTestDb", () => {
  it("dos instancias en serie no comparten estado", () => {
    const a = setupTestDb();
    a.db.prepare("INSERT INTO users (google_sub, email, domain, name, role) VALUES (?,?,?,?,?)").run(
      "sub-a",
      "a@teimas.com",
      "teimas.com",
      "A",
      "member",
    );
    a.cleanup();

    const b = setupTestDb();
    // Una DB nueva solo trae los placeholders sembrados por la migración 0010
    // (change 031); el usuario insertado en `a` no se filtra.
    const reales = b.db.prepare("SELECT * FROM users WHERE is_placeholder = 0").all();
    expect(reales).toHaveLength(0);
    const leaked = b.db.prepare("SELECT * FROM users WHERE google_sub = 'sub-a'").all();
    expect(leaked).toHaveLength(0);
    b.cleanup();
  });
});
