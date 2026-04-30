-- Añade default_office_id a users y crea tabla office_admins
ALTER TABLE users ADD COLUMN default_office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS office_admins (
  office_id  INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (office_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_office_admins_user ON office_admins(user_id);
