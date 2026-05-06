CREATE TABLE IF NOT EXISTS fixed_assignment_exceptions (
  id INTEGER PRIMARY KEY,
  fixed_assignment_id INTEGER NOT NULL REFERENCES fixed_assignments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (fixed_assignment_id, date)
);

CREATE INDEX IF NOT EXISTS idx_fixed_exceptions_date ON fixed_assignment_exceptions (date);
