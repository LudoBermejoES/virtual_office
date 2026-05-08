# Reservas — Delta para change 027-weekly-recurring-assignments

## ADDED Requirements

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
