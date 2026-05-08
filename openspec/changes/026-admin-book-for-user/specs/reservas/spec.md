# Reservas — Delta para change 026-admin-book-for-user

## ADDED Requirements

### Requirement: Reserva diaria a nombre de otro usuario por admin

El sistema MUST permitir a un admin crear o liberar una reserva diaria a nombre de cualquier usuario de la oficina, mediante el parámetro opcional `userId` en el body de los endpoints de bookings, manteniendo todas las validaciones existentes (ventana, fijos, conflictos).

#### Scenario: Admin reserva para otro usuario

- **GIVEN** un admin autenticado y un desk libre el día `D` dentro de la ventana de booking
- **WHEN** envía `POST /api/desks/:id/bookings` con body `{ date: D, userId: U }` donde U es otro usuario
- **THEN** el servidor responde 201 con `{ booking: { user_id: U, date: D, type: "daily" } }`
- **AND** registra log `booking.created.byAdmin` con `{ adminId, targetUserId: U, deskId, date: D }`
- **AND** difunde `desk.booked` por WS con el usuario destino (no con el admin)

#### Scenario: Usuario no-admin con userId en body

- **GIVEN** un usuario miembro autenticado
- **WHEN** envía `POST /api/desks/:id/bookings` con body `{ date, userId: <otro> }`
- **THEN** el servidor responde 403 con `{ reason: "forbidden" }`

#### Scenario: userId que no existe

- **GIVEN** un admin autenticado
- **WHEN** envía `POST` con `userId: 99999` (no existe)
- **THEN** el servidor responde 404 con `{ reason: "user_not_found" }`

#### Scenario: userId igual al caller (idempotente)

- **GIVEN** un admin autenticado con id A
- **WHEN** envía `POST` con `userId: A`
- **THEN** el servidor se comporta como si no hubiera pasado `userId` (reserva para A)
- **AND** NO registra log `byAdmin` (para no ensuciar la auditoría con self-bookings)

#### Scenario: Validaciones existentes aplican al usuario destino

- **GIVEN** un admin reserva para U y U ya tiene otra reserva el mismo día
- **WHEN** se envía el POST
- **THEN** el servidor responde 409 con `{ reason: "user_already_booked_today" }` (igual que self-booking)

#### Scenario: Admin libera la reserva de otro usuario

- **GIVEN** un admin autenticado y un desk reservado por U el día D
- **WHEN** envía `DELETE /api/desks/:id/bookings` con body `{ date: D, userId: U }`
- **THEN** el servidor responde 204
- **AND** la reserva de U para esa fecha en ese desk ya no existe
- **AND** registra log `booking.deleted.byAdmin`
- **AND** difunde `desk.unbooked` por WS

#### Scenario: Usuario no-admin con userId en DELETE

- **GIVEN** un usuario miembro
- **WHEN** envía `DELETE` con `userId: <otro>`
- **THEN** el servidor responde 403
