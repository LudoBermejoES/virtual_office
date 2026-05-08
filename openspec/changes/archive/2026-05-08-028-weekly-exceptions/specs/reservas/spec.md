# Reservas — Delta para change 028-weekly-exceptions

## ADDED Requirements

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
