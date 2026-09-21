# UI Game — Delta para change 031-blocked-placeholder-users

## ADDED Requirements

### Requirement: Los placeholders son seleccionables en el modal de reserva del admin

El sistema MUST ofrecer los tres usuarios `Bloqueado #N` en la lista de usuarios del modal de reserva del admin, al final y separados visualmente de las personas reales, de forma que bloquear un puesto sea el mismo gesto que reservarlo para un compañero.

#### Scenario: Los placeholders aparecen al final de la lista

- **GIVEN** un admin que clica un puesto libre y abre el modal en modo `book`
- **WHEN** se renderiza la lista de usuarios
- **THEN** los usuarios reales aparecen primero (el admin como `(yo)` arriba, el resto alfabético)
- **AND** los tres `Bloqueado #N` aparecen después, bajo un separador con el texto `BLOQUEAR PUESTO`

#### Scenario: Seleccionar un placeholder y guardar bloquea el puesto

- **GIVEN** el modal en modo `book` con la lista cargada
- **WHEN** el admin selecciona `Bloqueado #1` y pulsa `Guardar`
- **THEN** se invoca `onConfirmBook` con el `userId` de `Bloqueado #1`
- **AND** se envía `POST /api/desks/:id/bookings` con ese `userId`

#### Scenario: El filtro encuentra los placeholders

- **GIVEN** el modal en modo `book`
- **WHEN** el admin escribe `bloq` en el input de filtro
- **THEN** la lista muestra los tres `Bloqueado #N`
- **AND** no muestra usuarios reales que no coincidan

#### Scenario: Un placeholder ya usado ese día se muestra deshabilitado

- **GIVEN** `Bloqueado #1` ya tiene una reserva daily en otro puesto para la fecha del modal, en esta oficina o en cualquier otra
- **WHEN** se renderiza la lista en modo `book`
- **THEN** la fila de `Bloqueado #1` aparece deshabilitada y no seleccionable
- **AND** su `title` explica que ya está bloqueando otro puesto ese día
- **AND** `Bloqueado #2` y `Bloqueado #3` siguen seleccionables

#### Scenario: Un placeholder con puesto fijo sigue disponible para bloquear

- **GIVEN** `Bloqueado #2` tiene un puesto fijo asignado pero ninguna reserva daily en la fecha del modal
- **WHEN** se renderiza la lista en modo `book`
- **THEN** su fila sigue habilitada y seleccionable

#### Scenario: Los tres placeholders agotados

- **GIVEN** los tres placeholders tienen reserva daily ese día en otros puestos
- **WHEN** se renderiza la lista en modo `book`
- **THEN** las tres filas aparecen deshabilitadas
- **AND** el separador `BLOQUEAR PUESTO` muestra el aviso `sin bloqueos libres este día`

#### Scenario: Un puesto bloqueado abre el modal en modo release

- **GIVEN** un puesto con reserva daily de `Bloqueado #2` en la fecha activa
- **WHEN** un admin clica ese puesto
- **THEN** el modal se abre en modo `release` mostrando `Reservado por Bloqueado #2`
- **AND** el botón `Liberar reserva` desbloquea el puesto

#### Scenario: Los checkboxes de recurrencia funcionan sobre un placeholder

- **GIVEN** el modal en modo `book` con la fila de `Bloqueado #1` habilitada
- **WHEN** el admin marca el checkbox `L` de `Bloqueado #1` y pulsa `Guardar`
- **THEN** `onConfirmBook` recibe `weeklyChanges.create` con `{ userId: <Bloqueado #1>, dow: 0 }`

### Requirement: Render del puesto bloqueado en el mapa

El sistema MUST renderizar un puesto bloqueado igual que cualquier puesto ocupado por otra persona, mostrando el nombre `Bloqueado #N`. No se introduce estado visual, color ni `DeskState` nuevo.

#### Scenario: Estado del puesto bloqueado

- **GIVEN** un puesto con reserva de `Bloqueado #1` y un usuario cuyo `meId` es distinto
- **WHEN** se calcula `deskState(desk, bookings, meId)`
- **THEN** devuelve `"occupied"`

#### Scenario: Puesto bloqueado con fijo

- **GIVEN** un puesto con `fixed_assignment` a nombre de `Bloqueado #2`
- **WHEN** se calcula `deskState`
- **THEN** devuelve `"fixed"`, igual que con una persona real

#### Scenario: El nombre visible es el del placeholder

- **GIVEN** un puesto bloqueado a nombre de `Bloqueado #1`
- **WHEN** se renderiza la etiqueta del ocupante
- **THEN** muestra `Bloqueado #1`
- **AND** usa su `avatar_url` si tiene avatar custom, o el fallback por defecto si no

### Requirement: Sección propia de placeholders en la pestaña USUARIOS

El sistema MUST listar los tres placeholders en una sección separada de la pestaña USUARIOS del admin panel, sin acciones de rol, para que no se confundan con personas de la empresa.

#### Scenario: Sección separada sin acciones de rol

- **GIVEN** un admin en la pestaña `USUARIOS`
- **WHEN** se carga el listado
- **THEN** los usuarios reales aparecen bajo el título `USUARIOS` con sus botones `Avatar` y `Promover`/`Degradar`
- **AND** los tres placeholders aparecen bajo un título `PUESTOS BLOQUEADOS`
- **AND** las filas de los placeholders tienen botón `Avatar` pero NO tienen botones `Promover` ni `Degradar`

#### Scenario: Los placeholders no aparecen en la lista de invitaciones

- **GIVEN** un admin en la pestaña `USUARIOS`
- **WHEN** se carga la sección `INVITACIONES`
- **THEN** ninguna fila corresponde a un email de placeholder
