# UI Game — Delta para change 029-admin-weekly-panel

## ADDED Requirements

### Requirement: Pestaña "Recurrencias" en admin panel

El admin panel MUST exponer una pestaña dedicada a gestionar `weekly_assignments` y sus excepciones de toda la oficina, con tabla filtrable y acciones inline.

#### Scenario: Pestaña visible solo para admin

- **GIVEN** un usuario miembro autenticado
- **WHEN** abre el admin panel
- **THEN** la pestaña "RECURRENCIAS" no aparece (igual que el resto de pestañas admin)

#### Scenario: Listado base

- **GIVEN** un admin autenticado con la pestaña "RECURRENCIAS" activa
- **AND** la oficina tiene 5 weeklies activas
- **WHEN** se monta la pestaña
- **THEN** se llama `GET /api/offices/:id/weekly`
- **AND** se renderiza una tabla con 5 filas, cada una con columnas `Desk · Usuario · Día · Acciones`
- **AND** el orden por defecto es `día ascendente, desk ascendente`

#### Scenario: Filtro por usuario

- **GIVEN** la tabla con varias weeklies
- **WHEN** el admin escribe "ana" en el filtro de usuario
- **THEN** la tabla solo muestra weeklies cuyo `user.name` contiene "ana" (case-insensitive)

#### Scenario: Filtro por dow

- **GIVEN** la tabla con weeklies de varios días
- **WHEN** el admin selecciona "Lunes" en el filtro de día
- **THEN** la tabla solo muestra weeklies con `dow=0`

#### Scenario: Borrar weekly inline

- **GIVEN** una fila con weekly de Ana en desk5 los lunes
- **WHEN** el admin pulsa el botón de borrar
- **THEN** aparece confirm `window.confirm("¿Borrar la asignación recurrente de Ana en desk5 los lunes?")`
- **AND** si confirma, se llama `DELETE /api/desks/5/weekly/<id>`
- **AND** la fila desaparece de la tabla al éxito (sin recargar la pestaña entera)

#### Scenario: Indicador de excepciones

- **GIVEN** una weekly con dos `weekly_assignment_exceptions` futuras
- **WHEN** se renderiza la fila
- **THEN** se muestra un badge "2 excepciones" en la columna Acciones
- **AND** click en el badge muestra un popover con las fechas

#### Scenario: Limpiar todas las excepciones de una weekly

- **GIVEN** el popover de excepciones abierto
- **WHEN** el admin pulsa "Limpiar todas"
- **THEN** confirm + llamadas `DELETE /api/desks/:id/weekly/:weeklyId/exceptions { date }` por cada excepción
- **AND** el badge desaparece al terminar
