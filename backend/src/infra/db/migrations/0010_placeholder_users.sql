-- Usuarios placeholder "Bloqueado #N" (change 031).
-- Permiten a un admin bloquear un puesto sin ponerle encima a una persona
-- real, para gente que aún no ha entrado en la empresa.
-- Son tres filas de users normales: así respetan las reglas de unicidad
-- existentes (daily, weekly, fixed) sin modificar ningún índice. El precio
-- es un máximo de tres puestos bloqueados simultáneamente el mismo día.
ALTER TABLE users ADD COLUMN is_placeholder INTEGER NOT NULL DEFAULT 0;

-- Seed idempotente: google_sub es UNIQUE, así que INSERT OR IGNORE no
-- duplica si la migración se re-aplica sobre una DB que ya los tiene.
-- El google_sub sintético `placeholder:N` nunca colisiona con un `sub` de
-- Google (que es una cadena numérica), y `teimas.space` no está en
-- TEIMAS_DOMAINS: dos salvaguardas para que estas filas no puedan loguearse.
INSERT OR IGNORE INTO users
  (google_sub, email, domain, name, role, is_invited_external, is_placeholder)
VALUES
  ('placeholder:1', 'bloqueado1@teimas.space', 'teimas.space', 'Bloqueado #1', 'member', 0, 1),
  ('placeholder:2', 'bloqueado2@teimas.space', 'teimas.space', 'Bloqueado #2', 'member', 0, 1),
  ('placeholder:3', 'bloqueado3@teimas.space', 'teimas.space', 'Bloqueado #3', 'member', 0, 1);

CREATE INDEX IF NOT EXISTS idx_users_is_placeholder
  ON users (is_placeholder) WHERE is_placeholder = 1;
