-- Change 027: weekly recurring assignments.
-- Permite asignar un puesto a un usuario para todos los días de un cierto
-- día de la semana (dow 0..6, ISO 8601: 0=lunes, 6=domingo).
-- Coexiste con daily bookings y fixed assignments según las reglas de
-- precedencia: daily > fixed > weekly. Ver design.md decisión 5.

CREATE TABLE IF NOT EXISTS weekly_assignments (
  id INTEGER PRIMARY KEY,
  desk_id INTEGER NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dow INTEGER NOT NULL CHECK (dow >= 0 AND dow <= 6),
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (desk_id, dow),
  UNIQUE (user_id, dow)
);

CREATE INDEX IF NOT EXISTS idx_weekly_assignments_desk_dow
  ON weekly_assignments (desk_id, dow);

CREATE INDEX IF NOT EXISTS idx_weekly_assignments_user_dow
  ON weekly_assignments (user_id, dow);

-- Excepciones por fecha concreta (mismo modelo que fixed_assignment_exceptions).
CREATE TABLE IF NOT EXISTS weekly_assignment_exceptions (
  id INTEGER PRIMARY KEY,
  weekly_assignment_id INTEGER NOT NULL REFERENCES weekly_assignments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (weekly_assignment_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_exceptions_date
  ON weekly_assignment_exceptions (date);
