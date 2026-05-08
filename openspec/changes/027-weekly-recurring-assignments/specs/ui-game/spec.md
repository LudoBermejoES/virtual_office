# UI Game — Delta para change 027-weekly-recurring-assignments

## ADDED Requirements

### Requirement: Checkboxes por día de la semana en el modal admin de reserva

El modal admin de reserva (introducido en change 026) MUST mostrar 7 checkboxes (`L M X J V S D`) al lado del nombre de cada usuario en el modo `book`, para crear o borrar `weekly_assignments` desde el mismo flujo. Los checkboxes reflejan el estado actual y los cambios se aplican al pulsar "Guardar".

#### Scenario: Estado inicial refleja weeklies existentes

- **GIVEN** el modal abierto en modo `book` para `desk5` y la fecha de hoy
- **AND** existe `weekly_assignment(desk_id=5, user_id=A, dow=0)`
- **WHEN** el modal monta
- **THEN** el usuario A muestra el checkbox `L` marcado y los otros desmarcados
- **AND** los demás usuarios muestran sus checkboxes desmarcados

#### Scenario: Checkbox conflictivo deshabilitado

- **GIVEN** el usuario B ya tiene `weekly_assignment(desk_id=7, user_id=B, dow=0)` en otro desk
- **WHEN** se abre el modal sobre `desk5`
- **THEN** el checkbox `L` de B aparece deshabilitado con tooltip "B ya tiene un fijo semanal en otro puesto los lunes"
- **AND** los demás dows de B siguen habilitados

#### Scenario: Marcar checkbox crea weekly al guardar

- **GIVEN** el modal abierto, ningún cambio aún
- **WHEN** el admin marca el checkbox `M` del usuario A y pulsa "Guardar"
- **THEN** se ejecuta `POST /api/desks/:id/weekly` con `{ userId: A, dow: 1 }`
- **AND** el modal se cierra al éxito
- **AND** consultas posteriores de la oficina para martes incluyen el slot

#### Scenario: Desmarcar checkbox borra weekly al guardar

- **GIVEN** A tiene `weekly L` en desk5 (checkbox `L` marcado)
- **WHEN** el admin desmarca `L` y pulsa "Guardar"
- **THEN** se ejecuta `DELETE /api/desks/:id/weekly/:weeklyId` correspondiente
- **AND** el modal se cierra al éxito

#### Scenario: Múltiples cambios se aplican en orden

- **GIVEN** A tiene weekly `L` y B no tiene ningún weekly en este desk
- **WHEN** el admin desmarca `L` de A, marca `M` y `J` de B y pulsa "Guardar"
- **THEN** se ejecutan las 3 llamadas (1 DELETE + 2 POST)
- **AND** si una falla, las anteriores se mantienen y el modal muestra el error en el HUD

#### Scenario: Modo release no muestra checkboxes

- **GIVEN** el modal abierto en modo `release` (puesto ocupado por una reserva diaria)
- **WHEN** el modal monta
- **THEN** muestra solo el botón "Liberar reserva" sin la rejilla de checkboxes
- **AND** la liberación afecta solo al daily booking, no a weeklies del desk

#### Scenario: Modo fixed no permite weeklies

- **GIVEN** un desk con `fixed_assignment`
- **WHEN** el admin pulsa el desk
- **THEN** el modal se abre en modo `fixed` con el aviso habitual
- **AND** no se muestra rejilla de checkboxes (las weeklies no son aplicables sobre desks con fixed)
