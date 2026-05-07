/**
 * Migración a filename estable de TMJ por oficina (change 024).
 *
 * Histórico: el upload de mapa (change 005) guardaba el TMJ con nombre
 * `map_<sha256[:12]>.tmj`. Eso impide editar el TMJ in-place desde el editor
 * online porque cada PATCH cambiaría el filename y rompería las URLs cacheadas
 * en clientes con la oficina ya abierta.
 *
 * Esta migración recorre todas las oficinas, y para cada una con
 * `tmj_filename != "map.tmj"` renombra el fichero en disco a `map.tmj` y
 * actualiza la fila correspondiente. Idempotente: si ya está migrada o no
 * existe el fichero original, no hace nada.
 */
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { STABLE_TMJ_FILENAME } from "./office-maps.js";

export interface TmjFilenameMigrationResult {
  migrated: number;
  alreadyStable: number;
  missingFile: number;
}

interface OfficeRow {
  id: number;
  tmj_filename: string;
}

export function migrateTmjFilenames(
  db: DatabaseSync,
  officeMapsDir: string,
): TmjFilenameMigrationResult {
  const result: TmjFilenameMigrationResult = {
    migrated: 0,
    alreadyStable: 0,
    missingFile: 0,
  };

  const rows = db.prepare("SELECT id, tmj_filename FROM offices").all() as unknown as OfficeRow[];
  const update = db.prepare("UPDATE offices SET tmj_filename = ? WHERE id = ?");

  for (const row of rows) {
    if (row.tmj_filename === STABLE_TMJ_FILENAME) {
      result.alreadyStable++;
      continue;
    }
    const dir = join(officeMapsDir, String(row.id));
    const oldPath = join(dir, row.tmj_filename);
    const newPath = join(dir, STABLE_TMJ_FILENAME);

    if (!existsSync(oldPath)) {
      // Fichero ya renombrado o nunca subido. Si existe el destino, sólo
      // actualizamos la fila.
      if (existsSync(newPath)) {
        update.run(STABLE_TMJ_FILENAME, row.id);
        result.migrated++;
      } else {
        result.missingFile++;
      }
      continue;
    }

    // Si por alguna razón ya existe `map.tmj` además del legacy, preferimos el
    // legacy (que es al que apunta la fila) y sobreescribimos `map.tmj`.
    renameSync(oldPath, newPath);
    update.run(STABLE_TMJ_FILENAME, row.id);
    result.migrated++;
  }

  return result;
}
