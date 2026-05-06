# Invitaciones

## Purpose

Define el mecanismo por el que los administradores invitan a personas externas a la organización (sin email @teimas) a unirse a la oficina virtual. Cubre la creación de invitaciones con token único, su entrega via link, el canje en el primer login y la revocación.

## Requirements

### Requirement: Creación de invitación por administrador
El sistema MUST permitir a un usuario administrador crear una invitación para un email externo, generando un token de un solo uso con expiración limitada.

#### Scenario: Admin crea invitación válida
- GIVEN un usuario admin autenticado
- AND un email `cliente@externo.com` que no es de un dominio Teimas y no tiene user asociado
- WHEN solicita `POST /api/invitations { email }`
- THEN la respuesta es 201 con `{ id, email, token, expires_at, url }`
- AND `expires_at` es exactamente `now + INVITATION_TTL_DAYS`
- AND `url` apunta a `${PUBLIC_BASE_URL}/invite/${token}`
- AND `token` tiene 43 caracteres (32 bytes en base64url)

#### Scenario: Invitación a dominio Teimas rechazada
- GIVEN un admin autenticado
- WHEN intenta invitar a `compa@teimas.com`
- THEN la respuesta es 422 con `reason: "internal_domain"`

#### Scenario: Invitación a usuario ya existente
- GIVEN un user con email `socio@externo.com` ya creado
- WHEN un admin intenta invitarle
- THEN la respuesta es 409 con `reason: "already_user"`

#### Scenario: Invitación duplicada renueva token
- GIVEN una invitación viva para `cliente@externo.com`
- WHEN un admin envía otra invitación al mismo email
- THEN no se crea una segunda fila
- AND la fila existente se actualiza con un token nuevo y un `expires_at` extendido
- AND el token anterior queda inválido

#### Scenario: Member intenta crear invitación
- GIVEN un usuario con `role="member"`
- WHEN solicita `POST /api/invitations`
- THEN la respuesta es 403

### Requirement: Listado y revocación de invitaciones
El sistema MUST permitir a un admin listar invitaciones vivas y revocarlas individualmente.

#### Scenario: Listado por defecto solo vivas
- GIVEN una invitación viva, una expirada y una aceptada
- WHEN admin solicita `GET /api/invitations`
- THEN la respuesta contiene solo la viva

#### Scenario: Listado completo con flag
- GIVEN las mismas invitaciones
- WHEN admin solicita `GET /api/invitations?include=all`
- THEN la respuesta contiene las tres con sus estados

#### Scenario: Revocar invitación
- GIVEN una invitación viva
- WHEN admin solicita `DELETE /api/invitations/:id`
- THEN la respuesta es 204
- AND la fila persiste pero con `expires_at` ajustado al momento actual
- AND la invitación deja de aparecer en el listado por defecto

### Requirement: No exposición del token completo en logs
El sistema MUST NOT escribir el token completo de invitación en los logs estructurados.

#### Scenario: Crear invitación
- GIVEN un admin crea una invitación
- WHEN se inspeccionan los logs
- THEN aparece un evento `invitation.created` con prefijo del token (≤ 6 chars)
- AND no aparece el token completo en ningún log

### Requirement: Gestión de invitaciones desde el panel de administración

El sistema MUST permitir a un super-admin crear, revocar y renovar invitaciones desde el panel de administración. El sistema MUST exponer `POST /api/invitations/:id/renew` para renovar una invitación caducada o ya aceptada.

#### Scenario: Ver lista de invitaciones en el panel

- GIVEN el panel de administración abierto en la pestaña Usuarios/Invitaciones
- WHEN se carga la pestaña
- THEN se llama a `GET /api/invitations?include=all`
- AND se muestra tabla con columnas: Email, Estado, Invitado por, Expira, Acciones
- AND el estado se visualiza como: 🟢 Pendiente (no aceptada y no caducada), ✅ Aceptada, 🔴 Caducada

#### Scenario: Crear invitación desde el panel

- GIVEN el panel abierto en la pestaña Usuarios/Invitaciones
- WHEN el admin introduce un email en el campo y hace clic en "INVITAR"
- THEN se llama a `POST /api/invitations` con `{ email }`
- AND la nueva invitación aparece en la tabla con estado 🟢 Pendiente

#### Scenario: Revocar invitación pendiente

- GIVEN el panel con una invitación en estado 🟢 Pendiente
- WHEN el admin hace clic en "Revocar"
- THEN se llama a `DELETE /api/invitations/:id`
- AND la invitación desaparece de la lista o pasa a estado 🔴 Caducada

#### Scenario: Renovar invitación caducada

- GIVEN el panel con una invitación en estado 🔴 Caducada
- WHEN el admin hace clic en "Renovar"
- THEN se llama a `POST /api/invitations/:id/renew`
- AND la respuesta es 200
- AND la invitación pasa a estado 🟢 Pendiente con nueva fecha de expiración

#### Scenario: Renovar invitación ya aceptada

- GIVEN el panel con una invitación en estado ✅ Aceptada
- WHEN el admin hace clic en "Renovar"
- THEN se llama a `POST /api/invitations/:id/renew`
- AND la respuesta es 200
- AND se genera un nuevo token y nueva fecha de expiración
- AND el campo `accepted_at` se resetea a null

#### Scenario: No-admin no puede renovar invitaciones

- GIVEN un usuario con `role="member"`
- WHEN hace `POST /api/invitations/:id/renew`
- THEN la respuesta es 403
