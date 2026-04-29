# Autenticación

## Requirement: Configuración de sesión preparada
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

## Requirement: Login mediante ID token de Google
El sistema MUST aceptar un ID token de Google y, tras validarlo server-side con `google-auth-library`, abrir una sesión emitiendo una cookie firmada.

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

## Requirement: Promoción a administrador
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

## Requirement: Sesión por cookie firmada
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

## Requirement: Autorización por rol
El sistema MUST rechazar con 403 cualquier acceso a rutas marcadas como `requireAdmin` cuando el rol del usuario sea distinto de `admin`.

#### Scenario: Member intenta acción admin
- GIVEN un usuario con `role="member"`
- WHEN solicita una ruta protegida con `requireAdmin`
- THEN la respuesta es 403
