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
    const rows = b.db.prepare("SELECT * FROM users").all();
    expect(rows).toHaveLength(0);
    b.cleanup();
  });
});
