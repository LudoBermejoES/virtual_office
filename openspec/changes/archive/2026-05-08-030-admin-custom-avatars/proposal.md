## Why

El avatar de cada usuario se sincroniza desde el `picture` del ID token de Google en cada login (ver `auth.ts:90`, `users.ts:31` `ON CONFLICT DO UPDATE SET avatar_url = excluded.avatar_url`). Cuando esa URL no existe (cuenta sin foto, foto restringida, error 404 desde `googleusercontent.com`) el usuario aparece sin avatar y no hay forma de arreglarlo.

Casos reales:

- Usuarios externos invitados sin foto de Google.
- Cuentas corporativas con privacidad de imagen restringida en algunas redes.
- Foto antigua que el usuario quiere reemplazar por una más representativa para el contexto de oficina.

Hoy no hay alternativa: el siguiente login machaca cualquier URL custom porque `auth.ts` siempre escribe `avatar_url = payload.picture`.

## What Changes

- **Backend storage** — Nuevo directorio `AVATARS_DIR` en disco (config env), con filenames `<userId>_<hash>.<ext>` (ext: `png` | `webp` | `jpg`). Servidos estáticos con cache `immutable` (filename incluye hash, así un avatar nuevo es URL nueva).
- **Backend DB (migración)** — Nueva columna `users.avatar_locked INTEGER NOT NULL DEFAULT 0`. El upsert de Google (`upsertUserOnLogin`) pasa a hacer `avatar_url = CASE WHEN avatar_locked = 1 THEN avatar_url ELSE excluded.avatar_url END` para que un avatar manual no se machaque al loguear.
- **Backend endpoints (admin only)** — `POST /api/users/:id/avatar` (multipart con `image/png|webp|jpeg`, ≤ 1MB) sustituye el avatar y pone `avatar_locked = 1`. `DELETE /api/users/:id/avatar` borra el override, vuelve a `avatar_locked = 0` y deja `avatar_url = NULL` (la próxima sesión de Google la repondrá).
- **Limpieza de huérfanos** — Al subir un avatar nuevo o al hacer DELETE, si el `avatar_url` previo era una ruta local de avatares, se borra el fichero del disco antes de actualizar la DB.
- **Frontend** — En la pestaña `USUARIOS` del admin panel, cada fila gana botón "Avatar" que abre un modal con: preview actual, input file, botón "Subir", botón "Resetear" (si `avatar_locked = 1`).
- **Excepción documentada** — `CLAUDE.md` prohíbe JPEG en tilesets (artifacts de compresión sobre tilemaps). Para avatares pequeños (≤256px renderizado) el tradeoff cambia: aceptamos JPEG porque es el formato natural de las fotos que un admin tendrá a mano. Documentar en `design.md`.

## Impact

- **Specs afectadas**:
  - `autenticacion` (campo nuevo, upsert condicional, endpoints admin nuevos).
  - `ui-game` (modal admin de avatar en la pestaña USUARIOS).
- **Migración SQL**: `0009_user_avatar_locked.sql` añade `avatar_locked INTEGER NOT NULL DEFAULT 0`.
- **Env nueva**: `AVATARS_DIR` (default `data/avatars`). Debe estar en `.gitignore`.
- **Static serving**: nueva ruta `GET /avatars/:filename` con validación regex (igual patrón que `/maps/:officeId/:filename` para evitar path traversal).
- **Sin breaking changes en payloads existentes**: el front sigue leyendo `user.avatar_url`. Solo cambia que ahora puede apuntar a `/avatars/<userId>_<hash>.webp` en vez de a `googleusercontent.com`.
- **Sin nuevas dependencias**. Multipart se maneja con `@fastify/multipart` (ya en uso para upload de tilesets en change 020). Verificar antes de proponer.

## Dependencias

- Ninguna sobre changes en flight. Toca `auth.service` + `users` repo.

## Notas

- v1 admin-only. Self-service (`PATCH /api/me/avatar`) queda fuera; cuando se quiera, se reusa el endpoint admin con auth distinta.
- No redimensionamos server-side. El frontend ya pinta avatares pequeños (28-48px) y un fichero ≤1MB es asumible. Si en producción se ve que pesa, se añade `sharp` en un change posterior.
