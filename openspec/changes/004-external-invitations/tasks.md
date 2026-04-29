# Tareas: External Invitations

## 1. Backend: dominio y repos

- [ ] 1.1 (test unit) `Invitation.isLive(now)` devuelve true si no expirada y no aceptada.
- [ ] 1.2 (test unit) `generateInviteToken()` genera 32 bytes únicos en base64url.
- [ ] 1.3 `src/infra/repos/invitations.ts` con `create`, `findById`, `findLiveByEmail`, `markAccepted`, `revoke`, `listLive`.

## 2. Backend: endpoints admin

- [ ] 2.1 (test integration) `POST /api/invitations { email }` como admin crea invitación con token, expires_at = now + 7d.
- [ ] 2.2 (test integration) Crear invitación con email de dominio Teimas → 422 con `reason: "internal_domain"`.
- [ ] 2.3 (test integration) Crear invitación con email que ya es user existente → 409.
- [ ] 2.4 (test integration) Crear invitación duplicada para email pendiente → renueva token, no duplica fila.
- [ ] 2.5 (test integration) `GET /api/invitations` devuelve solo invitaciones vivas; con `?include=all` devuelve todas.
- [ ] 2.6 (test integration) `DELETE /api/invitations/:id` marca `expires_at = now`.
- [ ] 2.7 (test integration) Member intenta cualquiera de las anteriores → 403.

## 3. Backend: extensión de auth

- [ ] 3.1 (test unit) `checkDomain` con dominio Teimas retorna `internal`.
- [ ] 3.2 (test unit) `checkDomain` con dominio externo + token válido retorna `invited`.
- [ ] 3.3 (test unit) `checkDomain` con dominio externo + token caducado retorna `domain_not_allowed`.
- [ ] 3.4 (test unit) `checkDomain` con dominio externo + token de otro email retorna `domain_not_allowed`.
- [ ] 3.5 Modificar `POST /api/auth/google` para aceptar `inviteToken` opcional.
- [ ] 3.6 (test integration) Login externo con `inviteToken` válido crea user `is_invited_external=1` y marca `invitations.accepted_at`.
- [ ] 3.7 (test integration) Login externo con email distinto al de la invitación → 403.
- [ ] 3.8 (test integration) Reuso del token tras aceptar → 410.

## 4. Frontend

- [ ] 4.1 Detectar ruta `/invite/:token` en `main.ts`, guardar en `localStorage` y redirigir a login.
- [ ] 4.2 Modificar `LoginScene` para enviar `inviteToken` desde `localStorage` en el callback.
- [ ] 4.3 Mostrar mensaje legible si el backend devuelve 410 (invitación caducada).
- [ ] 4.4 Modal admin: lista de invitaciones vivas, botón "Invitar nuevo email", botón "Revocar".
- [ ] 4.5 Botón "Copiar link" en cada invitación creada (copia `${PUBLIC_BASE_URL}/invite/${token}`).

## 5. E2E

- [ ] 5.1 (e2e) Admin invita `cliente@externo.com`, copia link, simula login con Google del mismo email → entra como member externo.
- [ ] 5.2 (e2e) Mismo link reusado tras aceptar → mensaje "Invitación ya utilizada".
- [ ] 5.3 (e2e) Admin invita y revoca antes de usar → login del externo falla con mensaje "Invitación revocada".

## 6. Verificación

- [ ] 6.1 Coverage ≥ 80% para `invitations.ts` y `auth.ts`.
- [ ] 6.2 Logs no contienen el token completo, solo prefijo de 6 chars.
- [ ] 6.3 `pnpm test` y `pnpm e2e:chromium` en verde.
