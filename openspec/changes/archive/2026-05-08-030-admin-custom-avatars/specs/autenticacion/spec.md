# Autenticación — Delta para change 030-admin-custom-avatars

## ADDED Requirements

### Requirement: Avatar custom subido por admin

El sistema MUST permitir a un administrador subir, reemplazar y borrar un avatar de imagen para cualquier usuario. Cuando hay avatar custom, el flujo de login con Google MUST NOT sobrescribirlo. Los ficheros se sirven desde `AVATARS_DIR` con cache `immutable` por filename hash.

#### Scenario: Admin sube avatar PNG válido

- **GIVEN** un admin autenticado y un usuario con `avatar_locked = 0`
- **WHEN** envía `POST /api/users/:id/avatar` con `multipart/form-data` parte `file` con content-type `image/png`, magic bytes PNG válidos, tamaño 200KB
- **THEN** el servidor responde 200 con `{ user: { id, name, email, avatar_url } }`
- **AND** `avatar_url` tiene formato `/avatars/<userId>_<hash8>.png`
- **AND** `avatar_locked` queda en `1`
- **AND** se registra log `auth.avatar.uploaded.byAdmin` con `{ adminId, targetUserId, filename, sizeBytes, contentType }`

#### Scenario: Admin sube WebP válido

- **GIVEN** un admin autenticado
- **WHEN** envía `POST /api/users/:id/avatar` con content-type `image/webp` y magic bytes WebP válidos
- **THEN** el servidor responde 200 y `avatar_url` termina en `.webp`

#### Scenario: Admin sube JPEG válido

- **GIVEN** un admin autenticado
- **WHEN** envía `POST /api/users/:id/avatar` con content-type `image/jpeg` y magic bytes `FF D8 FF`
- **THEN** el servidor responde 200 y `avatar_url` termina en `.jpg`

#### Scenario: Content-type no permitido

- **WHEN** se envía un avatar con content-type `image/gif`
- **THEN** el servidor responde 400 con `{ reason: "bad_content_type" }`
- **AND** no se escribe nada en disco

#### Scenario: Magic bytes no coinciden con content-type

- **GIVEN** un fichero con content-type `image/png` cuyos primeros bytes no son la firma PNG
- **WHEN** se envía como avatar
- **THEN** el servidor responde 400 con `{ reason: "bad_image" }`

#### Scenario: Fichero excede el límite de 1MB

- **WHEN** se envía un avatar de 1.5MB
- **THEN** el servidor responde 400 con `{ reason: "file_too_large" }`

#### Scenario: Caller no admin

- **GIVEN** un usuario miembro autenticado
- **WHEN** intenta `POST /api/users/:id/avatar`
- **THEN** el servidor responde 403 con `{ reason: "not_authorized" }`

#### Scenario: Usuario destino no existe

- **WHEN** un admin envía `POST /api/users/9999/avatar` y el id no existe
- **THEN** el servidor responde 404 con `{ reason: "user_not_found" }`

#### Scenario: Reemplazar avatar custom existente borra el anterior

- **GIVEN** un usuario con `avatar_url = /avatars/42_aaaaaaaa.png` y `avatar_locked = 1`
- **WHEN** un admin sube un avatar nuevo
- **THEN** el servidor responde 200 con un `avatar_url` distinto (`/avatars/42_<otrohash>.<ext>`)
- **AND** el fichero anterior `42_aaaaaaaa.png` no existe ya en `AVATARS_DIR`

#### Scenario: Admin resetea avatar custom

- **GIVEN** un usuario con `avatar_url = /avatars/42_xxxx.webp` y `avatar_locked = 1`
- **WHEN** un admin envía `DELETE /api/users/42/avatar`
- **THEN** el servidor responde 200 con `{ user }`
- **AND** `avatar_url` queda en `NULL`
- **AND** `avatar_locked` queda en `0`
- **AND** el fichero `42_xxxx.webp` no existe ya en `AVATARS_DIR`
- **AND** se registra log `auth.avatar.reset.byAdmin`

#### Scenario: DELETE idempotente cuando no hay override

- **GIVEN** un usuario con `avatar_locked = 0` (avatar de Google o ninguno)
- **WHEN** un admin envía `DELETE /api/users/:id/avatar`
- **THEN** el servidor responde 200 sin error
- **AND** la fila de DB no cambia (sigue con su `avatar_url` actual y `avatar_locked = 0`)

#### Scenario: Login con avatar_locked=1 NO machaca el avatar custom

- **GIVEN** un usuario con `avatar_url = /avatars/42_xxxx.png` y `avatar_locked = 1`
- **WHEN** ese usuario hace login con un ID token cuyo `picture` apunta a una URL distinta de `googleusercontent.com`
- **THEN** `users.avatar_url` sigue siendo `/avatars/42_xxxx.png` tras el upsert
- **AND** `users.avatar_locked` sigue siendo `1`

#### Scenario: Login con avatar_locked=0 sí actualiza desde Google

- **GIVEN** un usuario con `avatar_locked = 0` y `avatar_url = https://lh3.googleusercontent.com/old`
- **WHEN** hace login con un ID token cuyo `picture` es `https://lh3.googleusercontent.com/new`
- **THEN** `avatar_url` pasa a `https://lh3.googleusercontent.com/new`

#### Scenario: GET /avatars/:filename sirve el fichero con cache immutable

- **GIVEN** un avatar guardado en `AVATARS_DIR` como `42_aaaaaaaa.webp`
- **WHEN** un cliente envía `GET /avatars/42_aaaaaaaa.webp`
- **THEN** el servidor responde 200 con el contenido y `Content-Type: image/webp`
- **AND** la cabecera `Cache-Control` incluye `public, max-age=31536000, immutable`

#### Scenario: GET /avatars con filename que no encaja la regex

- **WHEN** se envía `GET /avatars/../etc/passwd`
- **THEN** el servidor responde 400 con `{ reason: "bad_filename" }`
- **AND** no se accede al filesystem
