# Delta — Autenticación (extensión para externos)

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Login mediante ID token de Google
El sistema MUST aceptar un ID token de Google y, tras validarlo server-side con `google-auth-library`, abrir una sesión emitiendo una cookie firmada. El cuerpo del request MAY incluir `inviteToken` opcional para usuarios fuera de los dominios permitidos.
(Anterior: el endpoint solo aceptaba `idToken`; rechazaba todo lo que no tuviera `hd` en `TEIMAS_DOMAINS`.)

#### Scenario: Login válido de empleado Teimas
- GIVEN un empleado con cuenta Workspace cuyo `hd` está en `TEIMAS_DOMAINS`
- WHEN envía `POST /api/auth/google { idToken }` con un token con firma válida y `email_verified=true`
- THEN la respuesta es 200 y devuelve los datos públicos del usuario
- AND se emite una cookie `session` HttpOnly+Secure+SameSite=Lax
- AND el usuario queda persistido con `role="member"`, `is_invited_external=0`, `domain` extraído del email
