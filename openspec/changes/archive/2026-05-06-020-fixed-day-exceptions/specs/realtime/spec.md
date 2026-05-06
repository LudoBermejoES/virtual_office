# Realtime

## ADDED Requirements

### Requirement: Eventos WS de excepciones de fijos

El servidor SHALL difundir por el canal WebSocket de oficina los eventos correspondientes a la creación o eliminación de excepciones puntuales de fijos.

#### Scenario: desk.fixed_skipped al crear excepción

- **WHEN** se crea con éxito una excepción para el fijo del desk D, usuario U, fecha X
- **THEN** todos los clientes WS conectados al room de la oficina propietaria reciben `{type: "desk.fixed_skipped", deskId: D, userId: U, date: X}`

#### Scenario: desk.fixed_unskipped al borrar excepción

- **WHEN** se borra con éxito una excepción
- **THEN** todos los clientes reciben `{type: "desk.fixed_unskipped", deskId, userId, date}`

#### Scenario: Aislamiento por oficina

- **WHEN** la excepción es de un desk de la oficina X
- **THEN** solo los clientes en el room de la oficina X reciben el evento; clientes de otras oficinas no
