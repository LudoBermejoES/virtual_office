import { describe, it, expect, afterEach } from "vitest";
import { setupTestDb } from "../../support/db.js";

describe("setupTestDb", () => {
  const handles: ReturnType<typeof setupTestDb>[] = [];

  afterEach(() => {
    handles.forEach((h) => h.cleanup());
    handles.length = 0;
  });

  it("tiene la tabla _migrations con la versión 1 aplicada", () => {
    const { db } = setupTestDb();
    handles.push({ db, cleanup: () => db.close() });

    const rows = db
      .prepare("SELECT version FROM _migrations ORDER BY version")
      .all() as { version: number }[];

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.version).toBe(1);
  });
});
