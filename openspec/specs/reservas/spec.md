# Reservas

## Purpose

Modela las reservas diarias y las asignaciones fijas de puestos: cómo un usuario reserva un puesto para un día, cómo un administrador marca un puesto como fijo de un usuario concreto, las restricciones de unicidad y el horizonte de fechas permitido.

## Requirements


### Requirement: Reserva diaria de un puesto
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

### Requirement: Liberación de reserva
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

### Requirement: Asignación de puesto fijo
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

### Requirement: Retirada de puesto fijo
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

### Requirement: Materialización del fijo en el detalle del día
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

### Requirement: Bloqueo de daily sobre desk con fijo
El sistema MUST rechazar nuevas reservas diarias sobre un puesto que tiene asignación fija.

#### Scenario: Reserva daily sobre desk con fijo
- GIVEN A1 tiene fijo asignado a Bob
- WHEN Alice intenta `POST /api/desks/{A1.id}/bookings { date: "2026-05-05" }`
- THEN la respuesta es 409 con `reason: "desk_has_fixed_assignment"`

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

### Requirement: Asignación semanal recurrente por día de la semana

El sistema MUST permitir asignar un puesto a un usuario para todos los días de la semana correspondientes a un `dow` (0–6, 0 = lunes según ISO 8601), de forma indefinida hasta que se borre la asignación. Las asignaciones semanales coexisten con daily bookings, fixed assignments y exceptions con reglas de precedencia: **daily > fixed > weekly**, y `weekly_exceptions` invalidan el slot.

#### Scenario: Crear weekly recurring para un desk

- **GIVEN** un admin autenticado y un desk libre (sin `fixed_assignment`)
- **WHEN** envía `POST /api/desks/:id/weekly` con body `{ userId, dow: 0 }` (lunes)
- **THEN** el servidor responde 201 con `{ weekly: { id, desk_id, user_id, dow: 0 } }`
- **AND** futuras consultas de la oficina para una fecha lunes incluyen ese desk como reservado por `userId` con `type: "weekly"`

#### Scenario: Conflicto con fixed assignment

- **GIVEN** un desk con `fixed_assignment` activo
- **WHEN** se intenta `POST /api/desks/:id/weekly` con cualquier `userId` y `dow`
- **THEN** el servidor responde 409 con `{ reason: "desk_has_fixed_assignment" }`
- **AND** no se crea la weekly

#### Scenario: Conflicto desk_dow (dos personas mismo desk mismo dow)

- **GIVEN** un weekly existente para `(desk_id=5, dow=0)` con usuario A
- **WHEN** se intenta crear `(desk_id=5, dow=0)` con usuario B
- **THEN** el servidor responde 409 con `{ reason: "weekly_dow_conflict" }`

#### Scenario: Conflicto user_dow (mismo usuario dos desks mismo dow)

- **GIVEN** un weekly existente para `(user=A, dow=0, desk=5)`
- **WHEN** se intenta crear `(user=A, dow=0, desk=7)`
- **THEN** el servidor responde 409 con `{ reason: "user_dow_conflict" }`

#### Scenario: dow fuera de rango

- **WHEN** se envía `POST` con `dow: 7` o `dow: -1`
- **THEN** el servidor responde 400 (validación Zod)

#### Scenario: No-admin

- **GIVEN** un usuario miembro autenticado
- **WHEN** envía `POST /api/desks/:id/weekly`
- **THEN** el servidor responde 403

#### Scenario: Borrar weekly

- **GIVEN** un weekly existente con varias `weekly_exceptions`
- **WHEN** un admin envía `DELETE /api/desks/:id/weekly/:weeklyId`
- **THEN** el servidor responde 204
- **AND** la weekly se borra
- **AND** todas sus `weekly_exceptions` se borran (CASCADE)
- **AND** futuras consultas de oficina para fechas con ese dow ya no incluyen ese slot reservado

#### Scenario: Listado por oficina

- **GIVEN** una oficina con varias weeklies
- **WHEN** un admin envía `GET /api/offices/:id/weekly`
- **THEN** el servidor responde 200 con array de weeklies enriquecidas: `[{ id, desk: { id, label }, user: { id, name, email }, dow }]`

### Requirement: Precedencia entre daily, fixed y weekly al consultar el detalle de una oficina para una fecha

Para un par `(desk, date)` el booking efectivo MUST seguir la regla **daily > fixed > weekly**. Una `weekly_exception` cuyo `date` coincide con la fecha consultada invalida la weekly correspondiente (queda libre o cae al siguiente nivel de precedencia).

#### Scenario: Daily prevalece sobre weekly

- **GIVEN** un weekly de Ana en desk5 los lunes
- **AND** un admin reservó daily a Bob en desk5 para el lunes 2026-05-04
- **WHEN** un cliente consulta el detalle de la oficina con `date=2026-05-04`
- **THEN** el desk5 aparece reservado por Bob con `type: "daily"`
- **AND** Ana NO aparece en desk5 ese día (ni en otro desk derivado del weekly)

#### Scenario: Fixed prevalece sobre weekly que no debería existir

- **GIVEN** un fixed sobre desk5 (asignado a Carlos)
- **THEN** el sistema rechaza crear cualquier weekly sobre desk5 (ver Scenario "Conflicto con fixed assignment")
- **AND** la regla de precedencia no se ejerce porque el caso no puede ocurrir

#### Scenario: Weekly aplica si no hay daily ni fixed

- **GIVEN** un weekly de Ana en desk5 los lunes y NO hay daily ni fixed para `(desk5, 2026-05-04)`
- **WHEN** se consulta el detalle de la oficina con `date=2026-05-04`
- **THEN** desk5 aparece reservado por Ana con `type: "weekly"`

#### Scenario: weekly_exception suprime el slot

- **GIVEN** un weekly de Ana en desk5 los lunes
- **AND** un `weekly_exception(weekly_id=<el de Ana>, date="2026-05-04")`
- **WHEN** se consulta `date=2026-05-04`
- **THEN** desk5 aparece libre (Ana no proyectada ese día)

### Requirement: Excepciones de asignaciones semanales recurrentes

El sistema MUST exponer endpoints para crear y borrar `weekly_assignment_exceptions` que permiten saltarse un día concreto de una weekly recurrente sin borrar la weekly entera. Pueden actuar el propio dueño de la weekly o un admin de la oficina.

#### Scenario: User crea excepción de su propia weekly

- **GIVEN** un usuario autenticado con `weekly_assignment` en `desk5` los lunes
- **WHEN** envía `POST /api/desks/5/weekly/<weeklyId>/exceptions` con body `{ date: "2026-05-04" }` (un lunes)
- **THEN** el servidor responde 201 con `{ exception: { id, weekly_assignment_id, date } }`
- **AND** futuras consultas de la oficina con `date=2026-05-04` no proyectan ese desk como reservado

#### Scenario: Admin crea excepción de la weekly de otro usuario

- **GIVEN** un admin autenticado y una weekly de Ana en `desk5` los lunes
- **WHEN** envía `POST /api/desks/5/weekly/<weeklyAna>/exceptions` con `{ date: "2026-05-04" }`
- **THEN** el servidor responde 201
- **AND** registra log `weekly.exception.created.byAdmin` con `{ adminId, weeklyId, targetUserId, date }`

#### Scenario: User intenta crear excepción de weekly ajena

- **GIVEN** Bob autenticado, sin admin
- **AND** Ana tiene weekly en `desk5`
- **WHEN** Bob envía `POST /api/desks/5/weekly/<weeklyAna>/exceptions { date }`
- **THEN** el servidor responde 403 con `{ reason: "not_authorized" }`
- **AND** no se crea la excepción

#### Scenario: Fecha no coincide con el dow de la weekly

- **GIVEN** una weekly con `dow=0` (lunes)
- **WHEN** se envía `POST` con `date` cuyo dow es 2 (miércoles)
- **THEN** el servidor responde 422 con `{ reason: "date_dow_mismatch" }`

#### Scenario: Excepción duplicada

- **GIVEN** ya existe una excepción para `(weekly, date)`
- **WHEN** se envía un POST repetido
- **THEN** el servidor responde 409 con `{ reason: "exception_already_exists" }`

#### Scenario: weeklyId no pertenece al desk indicado

- **WHEN** se envía `POST /api/desks/3/weekly/<weeklyDe5>/exceptions`
- **THEN** el servidor responde 404 con `{ reason: "weekly_not_found" }`

#### Scenario: Borrar excepción ("vuelvo a venir")

- **GIVEN** existe una excepción `(weekly, date)`
- **WHEN** el dueño o un admin envía `DELETE /api/desks/:id/weekly/:weeklyId/exceptions` con body `{ date }`
- **THEN** el servidor responde 204
- **AND** futuras consultas de la oficina vuelven a proyectar la weekly para esa fecha

#### Scenario: User intenta borrar excepción ajena

- **GIVEN** Bob (no admin), excepción de Ana
- **WHEN** Bob envía `DELETE` apuntando a la excepción de Ana
- **THEN** el servidor responde 403

#### Scenario: Borrar excepción que no existe

- **WHEN** se envía DELETE para `(weekly, date)` sin excepción registrada
- **THEN** el servidor responde 404 con `{ reason: "exception_not_found" }`
