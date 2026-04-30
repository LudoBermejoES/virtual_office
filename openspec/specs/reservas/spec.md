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

## Requirement: Asignación de puesto fijo
El sistema MUST permitir a un administrador asignar a un usuario como ocupante fijo de un puesto, lo cual hace que ese puesto aparezca como ocupado por ese usuario en cualquier día consultado, salvo que ya exista una reserva diaria heredada.

#### Scenario: Asignación válida
- GIVEN un puesto A1 sin fijo asignado
- AND un usuario Bob sin fijo asignado en otro puesto
- WHEN un admin solicita `POST /api/desks/{A1.id}/fixed { userId: Bob.id }`
- THEN la respuesta es 201
- AND existe una fila en `fixed_assignments` con `desk_id=A1.id`, `user_id=Bob.id`

#### Scenario: Desk ya tiene fijo
- GIVEN A1 ya tiene un fijo asignado a Carol
- WHEN un admin intenta `POST /api/desks/{A1.id}/fixed { userId: Bob.id }`
- THEN la respuesta es 409 con `reason: "desk_already_fixed"`

#### Scenario: Usuario ya tiene fijo en otro puesto
- GIVEN Bob es fijo de A1
- WHEN un admin intenta asignar Bob como fijo de A2
- THEN la respuesta es 409 con `reason: "user_already_has_fixed"`

#### Scenario: Member intenta asignar
- GIVEN un usuario `member`
- WHEN solicita `POST /api/desks/:id/fixed`
- THEN la respuesta es 403

## Requirement: Retirada de puesto fijo
El sistema MUST permitir a un admin retirar la asignación fija de un puesto.

#### Scenario: DELETE válido
- GIVEN A1 tiene fijo asignado
- WHEN un admin solicita `DELETE /api/desks/{A1.id}/fixed`
- THEN la respuesta es 204
- AND la fila desaparece de `fixed_assignments`

#### Scenario: DELETE sin fijo asignado
- GIVEN A1 no tiene fijo
- WHEN un admin solicita `DELETE /api/desks/{A1.id}/fixed`
- THEN la respuesta es 404

## Requirement: Materialización del fijo en el detalle del día
El sistema MUST incluir la asignación fija como `booking` virtual con `type="fixed"` cuando se consulte un día sin reserva diaria preexistente para ese puesto.

#### Scenario: Día sin daily previa
- GIVEN A1 con fijo asignado a Bob
- AND ninguna `daily booking` para A1 en `2026-05-04`
- WHEN un usuario autenticado consulta `GET /api/offices/:id?date=2026-05-04`
- THEN `bookings` incluye `{ deskId: A1.id, userId: Bob.id, type: "fixed", user: { ..., avatar_url } }`

#### Scenario: Día con daily heredada previa al fijo
- GIVEN una daily booking de Carol en A1 para `2026-05-04` creada antes de asignar fijo a Bob
- AND un fijo de Bob en A1 asignado posteriormente
- WHEN se consulta `GET /api/offices/:id?date=2026-05-04`
- THEN `bookings` muestra la daily de Carol con `type: "daily"`, NO el fijo de Bob

## Requirement: Bloqueo de daily sobre desk con fijo
El sistema MUST rechazar nuevas reservas diarias sobre un puesto que tiene asignación fija.

#### Scenario: Reserva daily sobre desk con fijo
- GIVEN A1 tiene fijo asignado a Bob
- WHEN Alice intenta `POST /api/desks/{A1.id}/bookings { date: "2026-05-05" }`
- THEN la respuesta es 409 con `reason: "desk_has_fixed_assignment"`
