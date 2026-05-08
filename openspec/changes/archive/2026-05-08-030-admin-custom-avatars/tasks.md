# Tasks

## 1. Migración + repo

- [x] 1.1 Test integración: migración `0009_user_avatar_locked.sql` añade columna con default 0 sobre DB existente.
- [x] 1.2 Test unit: `upsertUserOnLogin` con `avatar_locked = 1` NO sobrescribe `avatar_url` aunque el `picture` del payload cambie.
- [x] 1.3 Test unit: `upsertUserOnLogin` con `avatar_locked = 0` (default) sí sobrescribe `avatar_url` con `picture` (comportamiento existente, regresión).
- [x] 1.4 Implementar `0009_user_avatar_locked.sql`.
- [x] 1.5 Adaptar `upsertUserOnLogin` con el `CASE WHEN` y refrescar la query.

## 2. Storage + helper

- [x] 2.1 Test unit: `detectImageType(buf)` reconoce PNG, WebP, JPEG y devuelve `null` para basura.
- [x] 2.2 Test unit: `validateAvatarFilename` acepta `42_a1b2c3d4.webp` y rechaza `../foo`, `42.png`, `42_xx.gif`.
- [x] 2.3 Test unit: `writeAvatarFile(userId, buf, ext)` escribe en `AVATARS_DIR` con filename `<userId>_<hash8>.<ext>` y devuelve la ruta `/avatars/...`.
- [x] 2.4 Test unit: `deleteAvatarFile(path)` borra solo si el path empieza por `/avatars/` y maneja ENOENT silenciosamente.
- [x] 2.5 Implementar helpers en `backend/src/infra/storage/avatars.ts` (no se necesitó service.ts adicional).
- [x] 2.6 Añadir `AVATARS_DIR` y `MAX_AVATAR_BYTES` a `parseEnv`.

## 3. Endpoints HTTP

- [x] 3.1 Test integración: `POST /api/users/:id/avatar` admin con PNG válido <=1MB → 200 + `avatar_url` empieza por `/avatars/` + `avatar_locked = 1`.
- [x] 3.2 Test integración: mismo endpoint con WebP → 200.
- [x] 3.3 Test integración: mismo endpoint con JPEG → 200.
- [x] 3.4 Test integración: con content-type `image/gif` → 400 `bad_content_type`.
- [x] 3.5 Test integración: con content-type PNG pero magic bytes no PNG → 400 `bad_image`.
- [x] 3.6 Test integración: fichero > 1MB → 400 `file_too_large`.
- [x] 3.7 Test integración: caller no admin → 403.
- [x] 3.8 Test integración: `:id` inexistente → 404.
- [x] 3.9 Test integración: subir avatar nuevo cuando ya hay uno custom → fichero anterior se borra del disco.
- [x] 3.10 Test integración: `DELETE /api/users/:id/avatar` admin → 200, `avatar_url = NULL`, `avatar_locked = 0`, fichero borrado.
- [x] 3.11 Test integración: `DELETE` cuando `avatar_locked = 0` (no había override) → 200 igualmente, idempotente.
- [x] 3.12 Test integración: `GET /avatars/<filename>` con filename válido → 200 + `Cache-Control: immutable`.
- [x] 3.13 Test integración: `GET /avatars/<filename>` con filename que no encaja la regex → 400 `bad_filename`.
- [x] 3.14 Implementar handlers en `backend/src/http/routes/avatars.ts` (nuevo).
- [x] 3.15 Registrar rutas en el server bootstrap.

## 4. Login regression

- [x] 4.1 Test integración: usuario con `avatar_locked = 1` y `avatar_url = /avatars/foo.png` se loguea de nuevo con `picture` distinto en el ID token → `avatar_url` sigue siendo `/avatars/foo.png`. (cubierto en `avatars.test.ts` describe "login regression").
- [x] 4.2 Test integración: usuario con `avatar_locked = 0` se loguea con nuevo `picture` → `avatar_url` se actualiza a la nueva URL de Google (regresión existente). (cubierto en `avatars.test.ts`).

## 5. Frontend: modal admin avatar

- [x] 5.1 Test unit: `mountAdminAvatarModal` con usuario sin override muestra preview de Google + input file + botón "Subir" (sin "Resetear").
- [x] 5.2 Test unit: con `avatar_locked = 1` muestra además botón "Resetear".
- [x] 5.3 Test unit: seleccionar fichero y pulsar "Subir" llama `POST` con `multipart/form-data`.
- [x] 5.4 Test unit: pulsar "Resetear" pide confirm y llama `DELETE`.
- [x] 5.5 Test unit: ESC y click fuera cierran con `onClose`.
- [x] 5.6 Implementar `frontend/src/ui/admin-avatar-modal.ts` (patrón doc-injection como `weekly-action-modal.ts`).

## 6. Wiring en admin panel

- [x] 6.1 Test unit cubierto a nivel de modal en `admin-avatar-modal.test.ts`. La integración admin-panel ↔ modal queda como verificación manual / e2e (3.7-2 sigue patrón del resto del panel, sin tests unit dedicados).
- [x] 6.2 Implementar el botón en `frontend/src/ui/admin-panel.ts` `buildUserRow`.
- [x] 6.3 Tras éxito (subida o reset), recargar la lista de usuarios (callback `onChanged`).

## 7. Validación final

- [x] 7.1 `openspec validate --all --strict` en verde.
- [x] 7.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [x] 7.3 `pnpm test` en verde.
- [x] 7.4 Verificado en dev: subida custom + relogin sin machacar + reset funcionan.
