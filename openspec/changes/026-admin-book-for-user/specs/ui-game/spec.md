# UI Game — Delta para change 026-admin-book-for-user

## ADDED Requirements

### Requirement: Modal admin para reservar/liberar a nombre de otro usuario

Cuando un usuario con rol admin pulsa un puesto en `OfficeScene`, el sistema MUST abrir un modal que permita seleccionar a quién reservar o liberar el puesto para el día actualmente seleccionado en el HUD, en lugar de aplicar la acción directamente al admin.

#### Scenario: Admin pulsa puesto vacío

- **GIVEN** un admin con la oficina abierta y la fecha `D` seleccionada
- **WHEN** pulsa un puesto que no tiene reserva ese día
- **THEN** se abre un modal con header "Reservar puesto <label> — <fecha formateada>"
- **AND** muestra un input de filtro y una lista de usuarios visibles
- **AND** el propio admin aparece como primer item con etiqueta "(yo)"
- **AND** el resto aparece en orden alfabético por nombre

#### Scenario: Admin filtra y reserva

- **GIVEN** el modal abierto sobre un puesto vacío
- **WHEN** el admin escribe parte del nombre o email en el filtro y pulsa sobre un usuario, después "Reservar"
- **THEN** se llama `POST /api/desks/:id/bookings` con `{ date, userId }`
- **AND** el modal se cierra al recibir 201
- **AND** la reserva aparece en el mapa con el avatar del usuario destino

#### Scenario: Admin pulsa puesto ocupado

- **GIVEN** un admin y un puesto con reserva diaria del usuario U el día `D`
- **WHEN** pulsa el puesto
- **THEN** el modal se abre en modo "ocupado" con header "Liberar puesto <label> — <fecha>"
- **AND** muestra "Reservado por <name> (<email>)"
- **AND** muestra un botón "Liberar reserva" en color de aviso

#### Scenario: Admin libera reserva ajena

- **GIVEN** el modal abierto en modo ocupado
- **WHEN** el admin pulsa "Liberar reserva"
- **THEN** se llama `DELETE /api/desks/:id/bookings` con `{ date, userId: <U> }`
- **AND** el modal se cierra al recibir 204
- **AND** el desk vuelve a estado libre en el mapa

#### Scenario: Puesto con fijo asignado

- **GIVEN** un admin pulsa un puesto que tiene `fixed_assignment` activo el día `D`
- **WHEN** el modal se abre
- **THEN** muestra "Asignado fijo a <name>" y un texto explicativo "Para gestionar fijos, usa el admin panel"
- **AND** los botones de reservar/liberar quedan deshabilitados

#### Scenario: ESC y click fuera cierran el modal

- **GIVEN** el modal abierto
- **WHEN** el admin pulsa ESC o hace click fuera de la caja del modal
- **THEN** el modal se desmonta sin acción
- **AND** no se llama a ningún endpoint

#### Scenario: Usuario no-admin no ve el modal

- **GIVEN** un usuario con rol member
- **WHEN** pulsa cualquier puesto del mapa
- **THEN** el flujo previo se mantiene exactamente (click en libre reserva para sí mismo, click en propio libera)
- **AND** el modal admin no aparece nunca
