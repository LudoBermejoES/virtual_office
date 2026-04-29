# Propuesta: Google Authentication

## Motivación

Todo el resto del sistema necesita usuarios autenticados. El usuario quiere "logueo solo con Google" para los empleados de Teimas (dominios permitidos) y, más adelante, para invitados externos (que también deben usar Google). Este change implementa el flujo OAuth 2.0 con verificación server-side del claim `hd`, la sesión por cookie firmada, los roles `admin`/`member`, y el bootstrap de admins desde `ADMIN_EMAILS`.

## Alcance

**En scope:**
- Endpoint `POST /api/auth/google` que valida un ID token con `google-auth-library`.
- Validación server-side del claim `hd` contra `TEIMAS_DOMAINS` (no se confía en el parámetro UI).
- Upsert de usuario por `google_sub`. Persistencia de email, dominio, name, avatar_url.
- Bootstrap de admins: en cada login, si el email está en `ADMIN_EMAILS`, se promueve a `admin`.
- Cookie de sesión JWT firmada (HS256, HttpOnly, Secure, SameSite=Lax) con TTL 7 días.
- Endpoint `GET /api/me` con datos del usuario autenticado.
- Endpoint `POST /api/auth/logout` que limpia la cookie.
- Plugin Fastify `auth-guard` con decorators `requireAuth` y `requireAdmin`.
- Frontend: `LoginScene` con botón "PRESS START — LOGIN WITH GOOGLE" usando Google Identity Services.
- Rate limit 10 req/min por IP en `/api/auth/google`.

**Fuera de scope:**
- Invitaciones a externos — change `004`.
- Refresh tokens (la cookie es de larga duración con rotación silenciosa).
- 2FA, magic links, contraseñas.

## Dominios afectados

`autenticacion`. Aporta los Requirements completos del login Google.

## Orden y dependencias

Change `003`. Depende de `001` (env, db, server) y `002` (tests).

## Impacto de seguridad

- **Crítico**: validación server-side del `hd` claim. El parámetro `hd` en la URL OAuth es solo UI; un atacante puede modificarlo. La verdad está en el ID token firmado por Google.
- **JWT**: HS256 con secret de 256 bits. Rotación documentada con `kid`.
- **Cookie**: HttpOnly, Secure (en prod), SameSite=Lax. Sin acceso desde JS.
- **Rate limit**: previene fuerza bruta a `verifyIdToken` (que pega contra Google).
- **Logs**: se registra `domain` y los primeros 4 chars del email; nunca el email completo, nunca el ID token.

## Rollback

Revertir el change. Los usuarios persisten en la tabla `users`; al volver a aplicar el change los usuarios siguen siendo válidos. Las cookies emitidas se invalidarían si se cambia el `SESSION_SECRET`.
