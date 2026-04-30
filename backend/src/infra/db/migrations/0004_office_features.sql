CREATE TABLE IF NOT EXISTS office_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('zone', 'room', 'label')),
  name TEXT NOT NULL,
  geometry_json TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  ordinal INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_office_features_office ON office_features(office_id);
