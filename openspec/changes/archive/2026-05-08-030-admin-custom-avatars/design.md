# Design — Avatares custom subidos por admin

## Modelo de datos

Migración `0009_user_avatar_locked.sql`:

```sql
ALTER TABLE users ADD COLUMN avatar_locked INTEGER NOT NULL DEFAULT 0;
```

- `avatar_locked = 0` → comportamiento actual: el upsert de Google sobrescribe `avatar_url`.
- `avatar_locked = 1` → admin ha subido avatar manual; el login de Google NO toca `avatar_url`.

`avatar_url` sigue siendo `TEXT NULL`. Cuando es manual, contiene una ruta absoluta-desde-raíz tipo `/avatars/42_a1b2c3d4.webp`. Cuando es de Google, contiene la URL `https://lh3.googleusercontent.com/...`.

## Upsert condicional

`upsertUserOnLogin` en `users.ts`:

```sql
INSERT INTO users (google_sub, email, domain, name, avatar_url, role, is_invited_external)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(google_sub) DO UPDATE SET
  email = excluded.email,
  name = excluded.name,
  avatar_url = CASE WHEN users.avatar_locked = 1 THEN users.avatar_url ELSE excluded.avatar_url END
```

Nota: hay que referenciar `users.avatar_locked` y `users.avatar_url` (la fila existente), no `excluded.*`. SQLite permite ambos en `DO UPDATE SET`.

## Storage en disco

- Nueva env `AVATARS_DIR`. Default en dev: `backend/data/avatars`. En producción `/var/www/teimas-space/backend/data/avatars`.
- Filename: `<userId>_<hash8>.<ext>` donde `hash8` = primeros 8 chars de un hash random (`crypto.randomBytes(4).toString("hex")`). Lo bastante único para evitar colisiones y suficientemente corto.
- Ext: `png` | `webp` | `jpg`. Validamos por content-type del multipart Y por magic bytes (primeros 4-12 bytes), no solo por la extensión que envía el cliente.
- Cache: respondemos con `Cache-Control: public, max-age=31536000, immutable` porque el filename incluye hash; cualquier cambio genera URL nueva.

## Endpoints

### `POST /api/users/:id/avatar` (admin only)

Multipart `image/png|webp|jpeg`, ≤ 1MB.

- 401 sin sesión.
- 403 si `me.role !== "admin"`.
- 400 si content-type no es uno de los tres permitidos, o si magic bytes no encajan, o si tamaño > 1MB, o si no hay parte file.
- 404 si el `:id` no existe.
- 200 con `{ user: { id, name, email, avatar_url } }`.

Side effects:
1. Si `users.avatar_url` actual empieza por `/avatars/`, borrar el fichero anterior de `AVATARS_DIR` antes del UPDATE (best-effort: log warning si falla, no abortar).
2. Escribir el nuevo fichero en `AVATARS_DIR/<userId>_<hash>.<ext>`.
3. `UPDATE users SET avatar_url = '/avatars/<filename>', avatar_locked = 1 WHERE id = :id`.
4. Log `auth.avatar.uploaded.byAdmin` con `{ adminId, targetUserId, filename, sizeBytes, contentType }`.

### `DELETE /api/users/:id/avatar` (admin only)

- 401/403/404 igual que arriba.
- 200 con `{ user }`.

Side effects:
1. Si `users.avatar_url` actual empieza por `/avatars/`, borrar fichero del disco (best-effort).
2. `UPDATE users SET avatar_url = NULL, avatar_locked = 0 WHERE id = :id`.
3. Log `auth.avatar.reset.byAdmin`.

El siguiente login del usuario afectado repondrá `avatar_url` desde Google (si el ID token trae `picture`).

### `GET /avatars/:filename`

Servidor estático. Validación regex estricta (mismo patrón que `/maps/:officeId/:filename`):

```
/^\d+_[a-f0-9]{8}\.(png|webp|jpg)$/
```

- 400 `bad_filename` si no encaja.
- 404 si el fichero no existe en `AVATARS_DIR`.
- 200 con `Content-Type` derivado de la extensión y `Cache-Control: public, max-age=31536000, immutable`.

No requiere autenticación (igual que `/maps/...`): si conoces el filename con hash random no adivinable, puedes verlo. Equivalente a "URL no listable" tipo Google Photos compartido.

## Magic bytes

Para evitar que se renombre un `.exe` a `.png`:

| Formato | Magic bytes |
|---------|-------------|
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| WebP | bytes 0–3 = `RIFF`, bytes 8–11 = `WEBP` |
| JPEG | `FF D8 FF` |

Helper `detectImageType(buf: Buffer): "png" | "webp" | "jpeg" | null` en `backend/src/services/image-validate.ts`. Si `null` o no coincide con el content-type del multipart, 400.

## JPEG: excepción documentada

`CLAUDE.md` prohíbe JPEG en tilesets porque la compresión introduce artifacts visibles a 100% sobre patrones repetitivos. Para avatares:

- Se renderizan a 28-48px en HUD, máximo 96px en modales.
- Vienen del workflow real de un admin: una foto descargada de Slack, WhatsApp, etc. — todas JPEG.
- Forzar conversión a PNG en el cliente añade fricción sin beneficio visible.

Aceptamos JPEG aquí. Si en futuro se ve que pesa, redimensionar a WebP server-side es un change pequeño.

## Frontend (resumen)

- En `admin-panel.ts` pestaña `USUARIOS`, cada fila de `buildUserRow` gana un botón "Avatar".
- El botón abre un modal nuevo `frontend/src/ui/admin-avatar-modal.ts` (siguiendo el patrón doc-injection de `weekly-action-modal.ts` para que sea unit-testable).
- Modal muestra: preview del avatar actual (con label "Google" o "Custom"), input file, botón "Subir", y si `avatar_locked = 1` también botón "Resetear" que llama `DELETE`.
- Tras éxito, recarga la lista.

## Tradeoffs descartados

- **Blob en SQLite**: rompe patrón de assets en disco; hace los `SELECT *` pesados; complica los backups.
- **Endpoint público `/api/users/:id/avatar` con stream**: añade auth en lectura sin beneficio (avatares no son secretos). El estático con hash basta.
- **Convertir a WebP server-side con `sharp`**: nueva dep, build más pesado, cero beneficio para v1.
- **Self-service**: fuera de scope. Cuando se quiera, se reusa storage + se añade `PATCH /api/me/avatar` con la misma validación.
