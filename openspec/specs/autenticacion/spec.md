# Autenticación

## Purpose

Establece cómo los usuarios de Teimas y los invitados externos prueban su identidad y mantienen una sesión válida en el sistema. Cubre la verificación del ID token de Google, la apertura y cierre de sesiones, la protección de rutas autenticadas y las salvaguardas de configuración (secrets, dominios permitidos).

## Requirements

### Requirement: Configuración de sesión preparada
El sistema MUST exigir un secret de sesión válido al arrancar y rechazar el boot si no está presente, aunque todavía no emita ni valide cookies.

#### Scenario: Arranque sin SESSION_SECRET
- GIVEN no se define la variable `SESSION_SECRET`
- WHEN el proceso intenta arrancar
- THEN el proceso termina con código 1
- AND el log incluye un error indicando la variable obligatoria faltante

#### Scenario: Arranque con SESSION_SECRET válido
- GIVEN `SESSION_SECRET` con al menos 32 bytes de entropía
- WHEN el proceso arranca
- THEN el servidor escucha en el puerto configurado
- AND no se emiten cookies todavía (emisión llega en el change 003)

### Requirement: Login mediante ID token de Google
El sistema MUST aceptar un ID token de Google y, tras validarlo server-side con `google-auth-library`, abrir una sesión emitiendo una cookie firmada. El cuerpo del request MAY incluir `inviteToken` opcional para usuarios fuera de los dominios permitidos.

#### Scenario: Login válido de empleado Teimas
- GIVEN un empleado con cuenta Workspace cuyo `hd` está en `TEIMAS_DOMAINS`
- WHEN envía `POST /api/auth/google { idToken }` con un token con firma válida y `email_verified=true`
- THEN la respuesta es 200 y devuelve los datos públicos del usuario
- AND se emite una cookie `session` HttpOnly+Secure+SameSite=Lax
- AND el usuario queda persistido con `role="member"`, `is_invited_external=0`, `domain` extraído del email
- AND el log incluye `auth.success` con el dominio pero NO el email completo ni el token

#### Scenario: Login con firma inválida
- GIVEN un ID token con firma corrupta o `audience` distinto al `GOOGLE_CLIENT_ID`
- WHEN se envía a `POST /api/auth/google`
- THEN la respuesta es 401 con `reason: "invalid_token"`
- AND no se crea ni actualiza ningún usuario

#### Scenario: Login con email no verificado
- GIVEN un ID token con `email_verified=false`
- WHEN se envía a `POST /api/auth/google`
- THEN la respuesta es 403 con `reason: "email_not_verified"`
- AND no se crea ni actualiza ningún usuario

#### Scenario: Login con dominio no permitido
- GIVEN un usuario sin `hd` en `TEIMAS_DOMAINS` y sin invitación viva
- WHEN se envía a `POST /api/auth/google`
- THEN la respuesta es 403 con `reason: "domain_not_allowed"`
- AND no se crea ni actualiza ningún usuario

#### Scenario: Rate limit en autenticación
- GIVEN una IP que envía 11 requests a `/api/auth/google` en un intervalo de 60 segundos
- WHEN llega el undécimo request
- THEN la respuesta es 429
- AND el log incluye `auth.rate_limited` con la IP

### Requirement: Promoción a administrador
El sistema MUST marcar como `admin` a cualquier usuario cuyo email aparezca en `ADMIN_EMAILS` en el momento del login.

#### Scenario: Admin definido por env
- GIVEN `ADMIN_EMAILS=ludo.bermejo@teimas.com`
- WHEN ese usuario hace login por primera vez
- THEN su `role` queda como `"admin"` en la base de datos
- AND `GET /api/me` devuelve `role: "admin"`

#### Scenario: Promoción en login posterior
- GIVEN un usuario `member` cuyo email se añade a `ADMIN_EMAILS` tras un redeploy
- WHEN vuelve a hacer login
- THEN su `role` se actualiza a `"admin"`

### Requirement: Sesión por cookie firmada
El sistema MUST proteger las rutas autenticadas exigiendo una cookie `session` con un JWT HS256 válido y vigente.

#### Scenario: Acceso autenticado a /api/me
- GIVEN un usuario con cookie `session` válida no expirada
- WHEN solicita `GET /api/me`
- THEN la respuesta es 200 con sus datos públicos

#### Scenario: Acceso sin cookie
- GIVEN un cliente sin cookie `session`
- WHEN solicita `GET /api/me`
- THEN la respuesta es 401

#### Scenario: Logout limpia la cookie
- GIVEN un usuario autenticado
- WHEN solicita `POST /api/auth/logout`
- THEN la respuesta es 204
- AND la cookie `session` se invalida en el cliente (`Max-Age=0`)

### Requirement: Autorización por rol
El sistema MUST rechazar con 403 cualquier acceso a rutas marcadas como `requireAdmin` cuando el rol del usuario sea distinto de `admin`.

#### Scenario: Member intenta acción admin
- GIVEN un usuario con `role="member"`
- WHEN solicita una ruta protegida con `requireAdmin`
- THEN la respuesta es 403

### Requirement: Login de invitado externo
El sistema MUST aceptar el login con Google de un usuario fuera de `TEIMAS_DOMAINS` cuando se acompañe un token de invitación viva cuyo email coincide con el del ID token.

#### Scenario: Externo con invitación válida
- GIVEN una invitación viva para `cliente@externo.com`
- WHEN ese usuario hace `POST /api/auth/google { idToken, inviteToken }` con un ID token cuyo email es `cliente@externo.com` y `email_verified=true`
- THEN la respuesta es 200 con cookie de sesión
- AND el user creado tiene `is_invited_external=1` y `role="member"`
- AND la invitación queda con `accepted_at = now`

#### Scenario: Token de invitación de otro email
- GIVEN una invitación viva para `cliente@externo.com`
- WHEN se intenta loguear con un ID token de `attacker@otro.com` enviando ese mismo `inviteToken`
- THEN la respuesta es 403 con `reason: "domain_not_allowed"`
- AND la invitación NO se marca como aceptada

#### Scenario: Token caducado
- GIVEN una invitación cuyo `expires_at` ya pasó
- WHEN el invitado intenta usar el `inviteToken`
- THEN la respuesta es 410 con `reason: "invitation_expired"`

#### Scenario: Token ya aceptado
- GIVEN una invitación con `accepted_at` no nulo
- WHEN se reusa el `inviteToken` en otro login
- THEN la respuesta es 410 con `reason: "invitation_already_used"`

### Requirement: Endpoint de sesión para tests automatizados
El sistema MUST exponer `POST /api/test/session` únicamente cuando la variable de entorno `TEST_AUTH=on` esté activa y `NODE_ENV` sea distinto de `production`. El endpoint MUST aceptar `{ email, role }`, crear el usuario si no existe, marcarlo como admin si `role==="admin"`, y devolver una cookie de sesión firmada idéntica a la del flujo Google.

#### Scenario: Generación de sesión válida
- GIVEN el servidor arrancado con `TEST_AUTH=on` y `NODE_ENV=test`
- WHEN se hace `POST /api/test/session` con `{ email: "alice@teimas.com", role: "member" }`
- THEN la respuesta es 200 con `Set-Cookie: vo_session=<jwt>; HttpOnly; Secure; SameSite=Lax`
- AND el JWT es válido para el resto de endpoints autenticados
- AND existe una fila en `users` con ese email

#### Scenario: Creación de admin
- GIVEN el servidor arrancado con `TEST_AUTH=on`
- WHEN se hace `POST /api/test/session` con `role: "admin"`
- THEN el usuario queda con `is_admin = 1` en la base de datos
- AND la cookie permite acceder a endpoints `/api/admin/*`

### Requirement: Salvaguarda de producción para test-auth
El sistema NUNCA MUST registrar el endpoint `POST /api/test/session` cuando `NODE_ENV=production`, incluso si `TEST_AUTH=on` está presente. El sistema MUST fallar el arranque con error fatal si ambas condiciones coinciden, en lugar de arrancar sin el endpoint.

#### Scenario: Fail-fast en producción
- GIVEN variables `NODE_ENV=production` y `TEST_AUTH=on`
- WHEN se invoca `buildServer({ env })`
- THEN la función lanza `Error("FATAL: TEST_AUTH=on en NODE_ENV=production")`
- AND el proceso no completa el arranque

#### Scenario: TEST_AUTH off
- GIVEN el servidor arrancado con `TEST_AUTH=off`
- WHEN se hace `POST /api/test/session`
- THEN la respuesta es 404 (la ruta no está registrada)
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
