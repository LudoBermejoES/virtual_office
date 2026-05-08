-- Avatar custom subido por admin (change 030).
-- Cuando avatar_locked=1, el upsert de Google login no debe sobrescribir
-- users.avatar_url (que apunta a `/avatars/<userId>_<hash>.<ext>` local).
ALTER TABLE users ADD COLUMN avatar_locked INTEGER NOT NULL DEFAULT 0;
