# Reservas


## Requirement: Reserva diaria de un puesto
El sistema MUST permitir a un usuario autenticado reservar un puesto libre para una fecha concreta dentro de un horizonte futuro acotado.

#### Scenario: Reserva en puesto libre
- GIVEN un puesto A1 sin reserva en `2026-05-04`
- AND un usuario autenticado Alice
- WHEN solicita `POST /api/desks/{A1.id}/bookings { date: "2026-05-04" }`
- THEN la respuesta es 201 con `{ id, deskId: A1.id, userId: Alice.id, date: "2026-05-04", type: "daily" }`
- AND queda persistida una fila en `bookings`

#### Scenario: Doble reserva en el mismo puesto y fecha
- GIVEN una reserva existente de Bob para A1 el `2026-05-04`
- WHEN Alice solicita `POST /api/desks/{A1.id}/bookings { date: "2026-05-04" }`
- THEN la respuesta es 409 con `reason: "desk_already_booked"`
- AND no se crea ninguna fila adicional

#### Scenario: Usuario ya tiene reserva ese día en otro puesto
- GIVEN Alice tiene una reserva en A1 el `2026-05-04`
- WHEN solicita `POST /api/desks/{A2.id}/bookings { date: "2026-05-04" }`
- THEN la respuesta es 409 con `reason: "user_already_booked_today"`

#### Scenario: Fecha en el pasado
- GIVEN hoy es `2026-05-04`
- WHEN Alice solicita reservar en `2026-05-01`
- THEN la respuesta es 422 con `reason: "date_in_past"`

#### Scenario: Fecha más allá del horizonte
- GIVEN hoy es `2026-05-04` y `BOOKING_HORIZON_DAYS=60`
- WHEN Alice solicita reservar en `2026-08-01`
- THEN la respuesta es 422 con `reason: "date_out_of_horizon"`

#### Scenario: Petición sin autenticación
- GIVEN un cliente sin cookie de sesión
- WHEN intenta `POST /api/desks/:id/bookings`
- THEN la respuesta es 401

## Requirement: Liberación de reserva
El sistema MUST permitir al usuario liberar su propia reserva. Un administrador MAY liberar reservas ajenas para casos administrativos. Las reservas de tipo `fixed` no se liberan por este endpoint.

#### Scenario: Usuario libera su reserva
- GIVEN Alice tiene una reserva daily en A1 el `2026-05-04`
- WHEN solicita `DELETE /api/desks/{A1.id}/bookings { date: "2026-05-04" }`
- THEN la respuesta es 204
- AND la fila se elimina

#### Scenario: Usuario intenta liberar reserva ajena
- GIVEN Bob tiene una reserva daily en A1 el `2026-05-04`
- WHEN Alice (member) solicita liberarla
- THEN la respuesta es 403

#### Scenario: Admin libera reserva ajena
- GIVEN Bob tiene una reserva daily en A1 el `2026-05-04`
- WHEN un admin solicita liberarla
- THEN la respuesta es 204
- AND la fila se elimina

#### Scenario: Liberar reserva inexistente
- GIVEN A1 no tiene reserva para `2026-05-04`
- WHEN cualquiera intenta liberarla
- THEN la respuesta es 404
