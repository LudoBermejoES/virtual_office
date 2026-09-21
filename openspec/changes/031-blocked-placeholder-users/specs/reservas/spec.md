# Reservas — Delta para change 031-blocked-placeholder-users

## ADDED Requirements

### Requirement: Bloqueo de un puesto a nombre de un placeholder

El sistema MUST aceptar un usuario placeholder (`is_placeholder = 1`) como destino de los mecanismos de reserva existentes exactamente igual que a un usuario real: reserva diaria a nombre de otro, asignación fija y asignación semanal recurrente. No se añade ningún endpoint ni ningún tipo de booking nuevo: bloquear un puesto es reservarlo a nombre de `Bloqueado #N`.

El sistema MUST seguir aplicando todas las validaciones existentes (ventana de fechas, fijos, conflictos de unicidad) sin excepción cuando el destino es un placeholder.

#### Scenario: Admin bloquea un puesto para un día concreto

- **GIVEN** un admin autenticado y un puesto A1 libre el día `D` dentro de la ventana de booking
- **WHEN** envía `POST /api/desks/{A1.id}/bookings` con body `{ date: D, userId: <id de Bloqueado #1> }`
- **THEN** la respuesta es 201 con `{ booking: { user_id: <Bloqueado #1>, date: D, type: "daily" } }`
- **AND** registra log `booking.created.byAdmin` con `{ adminId, targetUserId, deskId, date: D }`
- **AND** difunde `desk.booked` por WS con el usuario `Bloqueado #1`

#### Scenario: Admin desbloquea el puesto

- **GIVEN** un puesto A1 bloqueado a nombre de `Bloqueado #1` el día `D`
- **WHEN** un admin envía `DELETE /api/desks/{A1.id}/bookings` con body `{ date: D, userId: <id de Bloqueado #1> }`
- **THEN** la respuesta es 204
- **AND** la reserva ya no existe
- **AND** difunde `desk.released` por WS

#### Scenario: Tres puestos bloqueados el mismo día

- **GIVEN** un admin autenticado y tres puestos A1, A2 y A3 libres el día `D`
- **WHEN** bloquea A1 con `Bloqueado #1`, A2 con `Bloqueado #2` y A3 con `Bloqueado #3` para la misma fecha `D`
- **THEN** las tres respuestas son 201
- **AND** `GET /api/offices/:id?date=D` devuelve los tres puestos ocupados, cada uno por su placeholder

#### Scenario: Cuarto bloqueo el mismo día agota los placeholders

- **GIVEN** los tres placeholders ya tienen reserva daily el día `D` en A1, A2 y A3
- **WHEN** un admin intenta `POST /api/desks/{A4.id}/bookings { date: D, userId: <id de Bloqueado #1> }`
- **THEN** la respuesta es 409 con `reason: "user_already_booked_today"`
- **AND** no se crea ninguna fila adicional

#### Scenario: Un placeholder sí puede estar en puestos distintos en días distintos

- **GIVEN** `Bloqueado #1` tiene reserva daily en A1 el día `D`
- **WHEN** un admin lo reserva en A2 para el día `D+1`
- **THEN** la respuesta es 201
- **AND** ambas reservas coexisten

#### Scenario: Bloqueo indefinido mediante fijo

- **GIVEN** un admin autenticado y un puesto A1 sin fijo asignado
- **WHEN** envía `POST /api/desks/{A1.id}/fixed { userId: <id de Bloqueado #2> }`
- **THEN** la respuesta es 201
- **AND** existe una fila en `fixed_assignments` con `user_id = <Bloqueado #2>`
- **AND** `GET /api/offices/:id?date=<cualquier fecha>` muestra A1 ocupado por `Bloqueado #2` con `type: "fixed"`

#### Scenario: Bloqueo semanal recurrente

- **GIVEN** un admin autenticado y un puesto A1 sin fijo
- **WHEN** envía `POST /api/desks/{A1.id}/weekly { userId: <id de Bloqueado #3>, dow: 0 }`
- **THEN** la respuesta es 201
- **AND** las consultas de la oficina para una fecha lunes muestran A1 ocupado por `Bloqueado #3` con `type: "weekly"`

#### Scenario: Un placeholder no puede tener dos weeklies el mismo día de la semana

- **GIVEN** un weekly de `Bloqueado #1` en A1 con `dow: 0`
- **WHEN** un admin intenta crear un weekly de `Bloqueado #1` en A2 con `dow: 0`
- **THEN** la respuesta es 409 con `reason: "user_dow_conflict"`

#### Scenario: Excepción de un día sobre un bloqueo semanal

- **GIVEN** un weekly de `Bloqueado #1` en A1 los lunes
- **WHEN** un admin envía `POST /api/desks/{A1.id}/weekly/<weeklyId>/exceptions { date: <un lunes> }`
- **THEN** la respuesta es 201
- **AND** la consulta de la oficina para ese lunes muestra A1 libre

#### Scenario: Member no puede bloquear puestos

- **GIVEN** un usuario con `role="member"` autenticado
- **WHEN** envía `POST /api/desks/{A1.id}/bookings { date: D, userId: <id de Bloqueado #1> }`
- **THEN** la respuesta es 403 con `reason: "forbidden"`
- **AND** no se crea ninguna reserva

#### Scenario: Las validaciones de ventana aplican igual al placeholder

- **GIVEN** un admin autenticado y hoy es `2026-05-04`
- **WHEN** intenta bloquear un puesto para `2026-05-01` a nombre de `Bloqueado #1`
- **THEN** la respuesta es 422 con `reason: "date_in_past"`

#### Scenario: Un usuario real no puede reservar un puesto bloqueado

- **GIVEN** A1 bloqueado a nombre de `Bloqueado #1` el día `D`
- **WHEN** Alice (member) intenta `POST /api/desks/{A1.id}/bookings { date: D }`
- **THEN** la respuesta es 409 con `reason: "desk_already_booked"`

### Requirement: Proyección de los bloqueos en el detalle del día

El sistema MUST proyectar los bloqueos en `GET /api/offices/:id?date=D` con la misma forma y la misma precedencia `daily > fixed > weekly` que cualquier otra reserva, sin campo ni tipo adicional. El cliente distingue un bloqueo por el `name` del usuario, no por un tipo especial.

#### Scenario: Puesto bloqueado se proyecta como ocupado

- **GIVEN** A1 con reserva daily de `Bloqueado #1` el día `D`
- **WHEN** un usuario autenticado consulta `GET /api/offices/:id?date=D`
- **THEN** `bookings` incluye `{ deskId: A1.id, userId: <Bloqueado #1>, type: "daily", user: { name: "Bloqueado #1", avatar_url } }`
- **AND** el payload NO contiene ningún campo extra de bloqueo

#### Scenario: Precedencia daily sobre weekly con placeholders

- **GIVEN** un weekly de `Bloqueado #1` en A1 los lunes
- **AND** una reserva daily de Alice en A1 para el lunes `D`
- **WHEN** se consulta `GET /api/offices/:id?date=D`
- **THEN** A1 aparece reservado por Alice con `type: "daily"`
- **AND** `Bloqueado #1` no aparece ese día
