# Diseño técnico: External Invitations

## Modelo

La tabla `invitations` ya existe desde `001-project-foundation`. Este change añade los endpoints y la lógica del verifier.

```ts
type Invitation = {
  id: number;
  email: string;            // único: una invitación viva por email
  invited_by_user_id: number;
  token: string;            // base64url 32 bytes, único
  expires_at: string;       // ISO8601
  accepted_at: string | null;
  created_at: string;
};
```

## Endpoints

```
POST   /api/invitations          admin   { email }              → 201 { invitation }
GET    /api/invitations          admin                          → 200 [{ invitation }]
DELETE /api/invitations/:id      admin                          → 204
```

### Crear invitación

```
1. requireAdmin
2. validar email con Zod (RFC 5322 simplificado)
3. rechazar si email ∈ TEIMAS_DOMAINS (no se invita a internos por aquí)
4. rechazar si ya existe user con ese email
5. si existe invitación viva con ese email → la "renueva":
     - se genera nuevo token
     - se extiende expires_at
     - se loggea como renew, no como create
6. generar token = randomBytes(32).toString("base64url")
7. expires_at = now + INVITATION_TTL_DAYS (default 7)
8. insertar / actualizar
9. responder con la invitación (incluye token y URL completa)
```

La URL devuelta es `${PUBLIC_BASE_URL}/invite/${token}`. El admin la comparte manualmente (este change no envía email).

### Listar invitaciones

- Solo invitaciones vivas (no expiradas, no aceptadas) por defecto.
- `?include=all` para admin que quiere ver histórico.

### Revocar invitación

- Marca `expires_at = now()`. La fila se conserva por auditoría.

## Flujo de aceptación

El externo recibe el link `/invite/<token>`. El frontend:

1. Detecta `/invite/:token` y lo guarda en `localStorage`.
2. Redirige a `LoginScene`.
3. Tras login con Google, en el callback envía `POST /api/auth/google { idToken, inviteToken }`.
4. Backend valida:
   - ID token de Google firma OK, `email_verified=true`.
   - `payload.email` coincide **exactamente** con `invitations.email`.
   - `inviteToken` es válido, no expirado, no aceptado.
5. Si todo OK:
   - upsert user con `is_invited_external=1`, `role="member"`.
   - actualizar `invitations.accepted_at = now()`.
   - emitir cookie de sesión.
6. Si email no coincide → 403, no se crea user.
7. Si token caducado → 410 Gone con mensaje legible.

## Cambios al verifier

`isAllowedDomain` ahora retorna también motivo:

```ts
type DomainCheck =
  | { ok: true; reason: "internal" }
  | { ok: true; reason: "invited"; invitationId: number }
  | { ok: false; reason: "domain_not_allowed" };

function checkDomain(payload, inviteToken?, db): DomainCheck {
  if (allowedHd(payload.hd) || allowedSuffix(payload.email)) return { ok: true, reason: "internal" };
  if (inviteToken) {
    const inv = db.findLiveInvitationByEmail(payload.email);
    if (inv && inv.token === inviteToken) return { ok: true, reason: "invited", invitationId: inv.id };
  }
  return { ok: false, reason: "domain_not_allowed" };
}
```

## Decisión: token en payload, no en cookie

El token se envía explícitamente en el cuerpo del POST, no como cookie. Razones:
- Evita CSRF: el navegador no envía automáticamente este token.
- Permite al frontend mostrar el formulario de Google con el token visible para depurar si algo falla.

## Migración

Sin migración. La tabla ya existe.

## Variables de entorno

```
INVITATION_TTL_DAYS=7
PUBLIC_BASE_URL=https://teimas.space
```

## Observabilidad

- Crear invitación → log info `invitation.created { invitedBy, emailDomain }` (no el email completo).
- Aceptar invitación → log info `invitation.accepted { invitationId }`.
- Token expirado/inválido → log warn `invitation.invalid { reason }`.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Token leak por compartir URL en chat | TTL corto, revocable |
| Reuso del token tras aceptar | `accepted_at` no-null bloquea segundo uso |
| Email "alice@teimas.com" abre invitación de "alice@external.com" | Validación de email exacto en payload vs invitación |
| Admin invita a sí mismo o a interno | Validación rechaza email Teimas |
