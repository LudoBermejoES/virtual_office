import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, type TestDb } from "../../../support/db.js";
import {
  createWeekly,
  deleteWeeklyById,
  findActiveForDeskDate,
  findActiveForUserDate,
  findByDeskAndDow,
  listByOffice,
  WeeklyAssignmentConflict,
  createException,
  listActiveForOfficeDate,
} from "../../../../src/infra/repos/weekly-assignments.js";

function seed(testDb: TestDb): {
  officeId: number;
  deskIds: number[];
  userIds: number[];
} {
  const oRes = testDb.db
    .prepare(
      `INSERT INTO offices (name, tmj_filename, tile_width, tile_height, cells_x, cells_y, map_width, map_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("HQ", "map.tmj", 32, 32, 10, 10, 320, 320);
  const officeId = Number(oRes.lastInsertRowid);
  const deskIds = [1, 2, 3].map((i) => {
    const r = testDb.db
      .prepare("INSERT INTO desks (office_id, label, x, y, source) VALUES (?, ?, ?, ?, ?)")
      .run(officeId, `D${String(i)}`, i * 100, 100, "manual");
    return Number(r.lastInsertRowid);
  });
  const userIds = ["alice", "bob", "carol"].map((name, i) => {
    const r = testDb.db
      .prepare(
        `INSERT INTO users (google_sub, email, domain, name, role, is_invited_external) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(`sub-${String(i)}`, `${name}@teimas.com`, "teimas.com", name, "member", 0);
    return Number(r.lastInsertRowid);
  });
  return { officeId, deskIds, userIds };
}

describe("weekly-assignments repo", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it("createWeekly inserta y devuelve la fila", () => {
    const { deskIds, userIds } = seed(testDb);
    const w = createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    expect(w.desk_id).toBe(deskIds[0]);
    expect(w.user_id).toBe(userIds[0]);
    expect(w.dow).toBe(0);
  });

  it("UNIQUE (desk_id, dow) lanza WeeklyAssignmentConflict('desk_dow')", () => {
    const { deskIds, userIds } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    expect(() =>
      createWeekly(testDb.db, {
        desk_id: deskIds[0]!,
        user_id: userIds[1]!,
        dow: 0,
        created_by_user_id: userIds[0]!,
      }),
    ).toThrow(WeeklyAssignmentConflict);
  });

  it("UNIQUE (user_id, dow) lanza WeeklyAssignmentConflict('user_dow')", () => {
    const { deskIds, userIds } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    try {
      createWeekly(testDb.db, {
        desk_id: deskIds[1]!,
        user_id: userIds[0]!,
        dow: 0,
        created_by_user_id: userIds[0]!,
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(WeeklyAssignmentConflict);
      expect((e as WeeklyAssignmentConflict).column).toBe("user_dow");
    }
  });

  it("deleteWeeklyById borra la fila y CASCADE las excepciones", () => {
    const { deskIds, userIds } = seed(testDb);
    const w = createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    createException(testDb.db, w.id, "2026-05-04");
    expect(deleteWeeklyById(testDb.db, w.id)).toBe(true);
    const remainingException = testDb.db
      .prepare("SELECT * FROM weekly_assignment_exceptions WHERE weekly_assignment_id = ?")
      .get(w.id);
    expect(remainingException).toBeUndefined();
  });

  it("findByDeskAndDow encuentra la weekly correcta", () => {
    const { deskIds, userIds } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 2,
      created_by_user_id: userIds[0]!,
    });
    expect(findByDeskAndDow(testDb.db, deskIds[0]!, 2)?.user_id).toBe(userIds[0]);
    expect(findByDeskAndDow(testDb.db, deskIds[0]!, 3)).toBeNull();
  });

  it("listByOffice devuelve weeklies enriquecidas con desk + user", () => {
    const { officeId, deskIds, userIds } = seed(testDb);
    createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    createWeekly(testDb.db, {
      desk_id: deskIds[1]!,
      user_id: userIds[1]!,
      dow: 3,
      created_by_user_id: userIds[0]!,
    });
    const list = listByOffice(testDb.db, officeId);
    expect(list).toHaveLength(2);
    const byDow = list.find((w) => w.dow === 0)!;
    expect(byDow.desk.label).toBe("D1");
    expect(byDow.user.email).toBe("alice@teimas.com");
  });

  it("findActiveForDeskDate respeta excepciones (devuelve null si exceptuada)", () => {
    const { deskIds, userIds } = seed(testDb);
    const w = createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    // 2026-05-04 es lunes (dow=0)
    expect(findActiveForDeskDate(testDb.db, deskIds[0]!, "2026-05-04", 0)?.id).toBe(w.id);
    createException(testDb.db, w.id, "2026-05-04");
    expect(findActiveForDeskDate(testDb.db, deskIds[0]!, "2026-05-04", 0)).toBeNull();
    // Otro lunes (sin excepción) sí
    expect(findActiveForDeskDate(testDb.db, deskIds[0]!, "2026-05-11", 0)?.id).toBe(w.id);
  });

  it("findActiveForUserDate idem para user", () => {
    const { deskIds, userIds } = seed(testDb);
    const w = createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    expect(findActiveForUserDate(testDb.db, userIds[0]!, "2026-05-04", 0)?.id).toBe(w.id);
    createException(testDb.db, w.id, "2026-05-04");
    expect(findActiveForUserDate(testDb.db, userIds[0]!, "2026-05-04", 0)).toBeNull();
  });

  it("listActiveForOfficeDate proyecta sólo las weeklies del dow filtrando excepciones", () => {
    const { officeId, deskIds, userIds } = seed(testDb);
    const wA = createWeekly(testDb.db, {
      desk_id: deskIds[0]!,
      user_id: userIds[0]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    createWeekly(testDb.db, {
      desk_id: deskIds[1]!,
      user_id: userIds[1]!,
      dow: 0,
      created_by_user_id: userIds[0]!,
    });
    createWeekly(testDb.db, {
      desk_id: deskIds[2]!,
      user_id: userIds[2]!,
      dow: 3,
      created_by_user_id: userIds[0]!,
    });
    // 2026-05-04 lunes (dow=0): activos los dos primeros
    const activeMon = listActiveForOfficeDate(testDb.db, officeId, "2026-05-04", 0);
    expect(activeMon).toHaveLength(2);
    // Con excepción para wA: queda solo el segundo
    createException(testDb.db, wA.id, "2026-05-04");
    const activeMon2 = listActiveForOfficeDate(testDb.db, officeId, "2026-05-04", 0);
    expect(activeMon2).toHaveLength(1);
    // Jueves (dow=3): solo el tercero
    const activeThu = listActiveForOfficeDate(testDb.db, officeId, "2026-05-07", 3);
    expect(activeThu).toHaveLength(1);
  });
});
