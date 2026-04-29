# Propuesta: External Invitations

## Motivación

Los administradores deben poder invitar a personas que no pertenecen a los dominios Teimas (clientes, partners, freelances) para que utilicen la oficina virtual de forma puntual. La condición es que esos invitados también se autentiquen con Google, no con credenciales propias. Este change añade el modelo de invitación, los endpoints de gestión y la rama del flujo OAuth que acepta a externos invitados.

## Alcance

**En scope:**
- Tabla `invitations` con `email`, `token`, `expires_at`, `accepted_at`, `invited_by_user_id`.
- Endpoints admin para crear, listar y revocar invitaciones.
- Rama del flujo `POST /api/auth/google` que acepta a un usuario fuera de `TEIMAS_DOMAINS` si su email tiene una invitación viva.
- Marcado `is_invited_external=1` en el usuario resultante.
- TTL configurable de invitación (default 7 días).
- Idempotencia: enviar dos veces la misma invitación a un email pendiente la actualiza, no duplica.

**Fuera de scope:**
- Envío real de emails (queda como tarea documentada futura; en este change la app solo registra la invitación y un admin comparte el link manualmente).
- Auto-revocación tras N días sin uso.
- Invitaciones masivas por CSV.

## Dominios afectados

`invitaciones`, `autenticacion` (extiende los Requirements existentes con la rama de externos).

## Orden y dependencias

Change `004`. Depende de `003-google-auth`.

## Impacto de seguridad

- El token de invitación es de 32 bytes aleatorios codificados en base64url. Solo se usa para vincular al primer login con un email externo.
- El externo **igualmente** valida ID token con Google: el token de invitación no concede acceso por sí solo, solo desbloquea la rama "no Teimas pero permitido" del verifier.
- Logs nunca incluyen el token completo (solo los primeros 6 chars, suficientes para correlacionar sin permitir reuso).
- La invitación caduca; expirada, se trata como inexistente.

## Rollback

Revertir tablas y rutas. Los usuarios externos creados durante el periodo siguen en `users` (con `is_invited_external=1`); si se quiere invalidar acceso, basta con bajar a `member` o eliminar (`DELETE FROM users`).
