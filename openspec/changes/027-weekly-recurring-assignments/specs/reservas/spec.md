# Reservas — Delta para change 027-weekly-recurring-assignments

NOTA: este change está en fase de propuesta. Los Scenarios completos se cerrarán en `design.md` antes de empezar la implementación. Lo que sigue es el esqueleto mínimo para que el spec valide.

## ADDED Requirements

### Requirement: Asignación semanal recurrente por día de la semana

El sistema MUST permitir asignar un puesto a un usuario para todos los días de la semana correspondientes a un `dow` (0–6, 0 = lunes ISO 8601), de forma indefinida hasta que se borre la asignación. Las asignaciones semanales coexisten con daily bookings y fixed assignments con reglas de precedencia: fixed > weekly > daily.

#### Scenario: Crear weekly recurring para un desk

- **GIVEN** un admin autenticado y un desk libre (sin fixed_assignment)
- **WHEN** envía `POST /api/desks/:id/weekly` con body `{ userId, dow }` donde `dow ∈ [0..6]`
- **THEN** el servidor responde 201 con `{ weekly: { id, desk_id, user_id, dow } }`
- **AND** el desk aparece reservado para `userId` en la oficina cada vez que se consulte una fecha cuyo `dow` coincida

#### Scenario: Conflicto con fixed assignment

- **GIVEN** un desk con `fixed_assignment` activo
- **WHEN** se intenta crear un weekly sobre ese desk
- **THEN** el servidor responde 409 con `{ reason: "desk_has_fixed_assignment" }`

#### Scenario: Conflicto con otra weekly del mismo dow

- **GIVEN** un desk con weekly para `dow=0` (lunes) asignado al usuario A
- **WHEN** se intenta crear weekly para el mismo desk con `dow=0` y usuario B
- **THEN** el servidor responde 409 con `{ reason: "weekly_dow_conflict" }`

#### Scenario: Borrar weekly

- **GIVEN** un weekly existente
- **WHEN** un admin envía `DELETE /api/desks/:id/weekly/:weeklyId`
- **THEN** el servidor responde 204
- **AND** el desk vuelve a estar libre en los días de ese `dow` (salvo daily bookings o fijos que ya hubiera)
