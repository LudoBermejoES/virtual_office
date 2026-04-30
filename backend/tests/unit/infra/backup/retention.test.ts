import { describe, it, expect } from "vitest";
import { filesToDelete } from "../../../../src/infra/backup/retention.js";

// Formato de nombres: YYYY-MM-DD-HHmm.db.gz
function name(y: number, m: number, d: number, h = 3, min = 0): string {
  return `${String(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${String(h).padStart(2, "0")}${String(min).padStart(2, "0")}.db.gz`;
}

describe("filesToDelete", () => {
  it("no borra nada si todos los ficheros están dentro de los últimos 30 días", () => {
    const now = new Date("2026-05-01T03:00:00Z");
    const files = [
      name(2026, 4, 25),
      name(2026, 4, 20),
      name(2026, 4, 10),
      name(2026, 4, 3),
    ];
    expect(filesToDelete(files, now)).toEqual([]);
  });

  it("borra ficheros de más de 30 días que no son el último del mes", () => {
    const now = new Date("2026-05-01T03:00:00Z");
    const files = [
      name(2026, 4, 1),   // 30 días — en el límite, se conserva
      name(2026, 3, 31),  // 31 días, último de marzo → conservar (último del mes)
      name(2026, 3, 15),  // 31+ días, no es el último de su mes → borrar
      name(2026, 2, 28),  // más antiguo, último de febrero → conservar
      name(2026, 2, 10),  // antiguo, no último de febrero → borrar
    ];
    const result = filesToDelete(files, now);
    expect(result).toContain(name(2026, 3, 15));
    expect(result).toContain(name(2026, 2, 10));
    expect(result).not.toContain(name(2026, 4, 1));
    expect(result).not.toContain(name(2026, 3, 31));
    expect(result).not.toContain(name(2026, 2, 28));
  });

  it("conserva el fichero más reciente de cada mes antiguo aunque haya varios", () => {
    const now = new Date("2026-05-01T03:00:00Z");
    const files = [
      name(2026, 3, 31),  // más reciente de marzo → conservar
      name(2026, 3, 20),  // otro de marzo → borrar
      name(2026, 3, 1),   // otro de marzo → borrar
    ];
    const result = filesToDelete(files, now);
    expect(result).toContain(name(2026, 3, 20));
    expect(result).toContain(name(2026, 3, 1));
    expect(result).not.toContain(name(2026, 3, 31));
  });

  it("retorna array vacío con lista de ficheros vacía", () => {
    expect(filesToDelete([], new Date())).toEqual([]);
  });

  it("ignora ficheros con nombres que no coinciden con el patrón", () => {
    const now = new Date("2026-05-01T03:00:00Z");
    const files = ["README.md", "some-other-file.txt", name(2026, 3, 1)];
    // El fichero con nombre inválido no debe provocar error ni ser borrado
    const result = filesToDelete(files, now);
    expect(result).not.toContain("README.md");
    expect(result).not.toContain("some-other-file.txt");
  });
});
