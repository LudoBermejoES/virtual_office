# UI Game — Delta para change 028-weekly-exceptions

## ADDED Requirements

### Requirement: Modal de gestión de weekly al pulsar un puesto recurrente

Cuando un usuario pulsa un puesto cuya reserva visible para el día seleccionado es de tipo `weekly`, el sistema MUST abrir un modal específico que ofrece acciones según el rol del usuario y si la weekly es propia.

#### Scenario: User pulsa su propia weekly del día

- **GIVEN** un usuario miembro autenticado con `weekly_assignment` en `desk5` los lunes
- **AND** la fecha seleccionada es un lunes sin excepción activa para esa weekly
- **WHEN** pulsa `desk5`
- **THEN** se abre un modal con título "Tu puesto fijo recurrente — <fecha>"
- **AND** muestra dos botones: "Saltarme hoy" y "Cancelar"
- **AND** "Saltarme hoy" llama `POST /api/desks/5/weekly/<weeklyId>/exceptions { date }`

#### Scenario: User pulsa su weekly cuando ya tiene excepción

- **GIVEN** el usuario tiene weekly en `desk5` los lunes y una excepción activa para `2026-05-04`
- **AND** la fecha seleccionada es `2026-05-04`
- **WHEN** pulsa `desk5`
- **THEN** el desk se ve libre para él, así que el modal weekly NO aparece
- **AND** sigue el flujo normal de "puesto libre" (puede reservarlo daily, etc.)

#### Scenario: User pulsa weekly ajena

- **GIVEN** Bob (no admin) ve `desk5` ocupado por Ana (weekly)
- **WHEN** Bob pulsa `desk5`
- **THEN** el sistema muestra solo `showFeedback("Ocupado por Ana")` igual que con dailies ajenas
- **AND** no se abre modal de weekly

#### Scenario: Admin pulsa weekly de cualquiera (incluso suya)

- **GIVEN** un admin pulsa `desk5` ocupado por una weekly (de él o de otro)
- **WHEN** la fecha seleccionada coincide con el dow de la weekly
- **THEN** se abre un modal con título "Puesto recurrente de <name> — <día>"
- **AND** muestra tres botones:
  - "Saltar este <día>" (crea exception solo para esa fecha)
  - "Quitar todos los <día>" (borra la weekly entera, requiere confirm extra)
  - "Cancelar"

#### Scenario: Admin elige "Quitar todos los <día>" — confirm

- **GIVEN** el modal admin abierto
- **WHEN** el admin pulsa "Quitar todos los miércoles"
- **THEN** aparece un confirm `window.confirm("¿Quitar la asignación recurrente entera? Esto afectará a todos los miércoles futuros.")`
- **AND** si confirma, se llama `DELETE /api/desks/:id/weekly/:weeklyId`
- **AND** si cancela, no pasa nada

#### Scenario: Bug fix — admin pulsa weekly proyectada ya no da 404

- **GIVEN** un admin pulsa un desk ocupado por una weekly
- **WHEN** se abre el flujo (modal nuevo de este change)
- **THEN** se llama al endpoint correcto (`/weekly/.../exceptions` o `/weekly/...`)
- **AND** NO se llama `DELETE /api/desks/:id/bookings` (que devolvería 404 porque el booking weekly no es una row real en `bookings`)
