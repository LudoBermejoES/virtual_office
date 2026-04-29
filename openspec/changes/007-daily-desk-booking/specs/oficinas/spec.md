# Delta — Oficinas

## MODIFIED Requirements

### Requirement: Listado y consulta de oficinas
El sistema MUST permitir a cualquier usuario autenticado listar oficinas y consultar el detalle de una oficina, incluyendo desks y, cuando se especifica `?date=YYYY-MM-DD`, las reservas de ese día con datos públicos del usuario que reservó (incluido `avatar_url`).

#### Scenario: Detalle con reservas del día
- GIVEN una oficina con dos puestos y una reserva de Alice en A1 para `2026-05-04`
- WHEN un usuario autenticado solicita `GET /api/offices/:id?date=2026-05-04`
- THEN la respuesta incluye `office`, `desks` con dos elementos, y `bookings: [{ id, deskId, userId, type, user: { id, name, avatar_url } }]` con la reserva de Alice
- AND el `avatar_url` proviene del campo `picture` del ID token de Google de Alice (persistido en `users.avatar_url` durante el login)

#### Scenario: Detalle sin parámetro date
- GIVEN una oficina con reservas en distintos días
- WHEN un usuario autenticado solicita `GET /api/offices/:id` sin `?date=`
- THEN la respuesta incluye solo las reservas correspondientes al día actual del servidor en UTC
