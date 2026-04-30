# Delta — Invitaciones

## ADDED Requirements

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
