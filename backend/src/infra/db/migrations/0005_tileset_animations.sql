-- Añade la columna animations_json a office_tilesets y crea la tabla office_npcs
ALTER TABLE office_tilesets ADD COLUMN animations_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS office_npcs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  sprite TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_office_npcs_office ON office_npcs(office_id);
