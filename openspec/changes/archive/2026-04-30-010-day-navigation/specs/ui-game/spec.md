# Delta — UI Game

## ADDED Requirements

### Requirement: Navegación entre días con teclado y botones
El sistema MUST permitir al usuario avanzar y retroceder entre días desde la `OfficeScene` mediante botones HUD y atajos de teclado, dentro del intervalo `[hoy - HISTORY_VISIBLE_DAYS, hoy + BOOKING_HORIZON_DAYS - 1]`.

#### Scenario: Avanzar un día
- GIVEN un usuario viendo la oficina con fecha actual
- WHEN pulsa `→` o el botón `>`
- THEN la etiqueta muestra el día siguiente formateado en castellano (`"viernes 8 de mayo de 2026"`)
- AND el snapshot del nuevo día se refresca

#### Scenario: Retroceder un día
- GIVEN un usuario en la fecha actual
- WHEN pulsa `←` o el botón `<`
- THEN se muestra el día anterior

#### Scenario: Botón "Hoy" volver
- GIVEN un usuario navegado a una fecha distinta de hoy
- WHEN pulsa `Home` o el botón `[Hoy]`
- THEN la fecha vuelve a la de hoy del navegador

#### Scenario: Límite hacia adelante
- GIVEN la fecha seleccionada coincide con `hoy + BOOKING_HORIZON_DAYS - 1`
- WHEN se intenta avanzar
- THEN la acción no produce cambio
- AND el botón `>` queda deshabilitado

#### Scenario: Límite hacia atrás
- GIVEN la fecha seleccionada coincide con `hoy - HISTORY_VISIBLE_DAYS`
- WHEN se intenta retroceder
- THEN la acción no produce cambio
- AND el botón `<` queda deshabilitado

### Requirement: Persistencia de día en la sesión del navegador
El sistema MUST recordar el último día visitado durante la sesión del navegador, restaurándolo al recargar; MUST NOT persistir entre cierres y aperturas de pestaña distintos.

#### Scenario: Recarga conserva el día
- GIVEN un usuario que navegó a `2026-05-09`
- WHEN recarga la página
- THEN al volver a `OfficeScene` la fecha es `2026-05-09`

#### Scenario: Reapertura tras cerrar pestaña
- GIVEN un usuario cerró la pestaña ayer mientras estaba en `2026-05-09`
- WHEN abre una nueva pestaña hoy `2026-05-10`
- THEN la fecha mostrada es la del día actual `2026-05-10`

### Requirement: Aplicación selectiva de deltas en realtime
El sistema MUST filtrar los mensajes WebSocket de tipo `desk.booked` y `desk.released` para que solo modifiquen el snapshot visible cuando coinciden con la fecha seleccionada en el cliente. Los mensajes `desk.fixed`, `desk.unfixed` y `office.updated` afectan a todos los días.

#### Scenario: Reserva del día visible
- GIVEN Alice ve el día `2026-05-04`
- WHEN llega `{ type: "desk.booked", deskId: A1.id, date: "2026-05-04", user }`
- THEN A1 cambia a estado ocupado en su pantalla

#### Scenario: Reserva en otro día
- GIVEN Alice ve el día `2026-05-04`
- WHEN llega `{ type: "desk.booked", deskId: A1.id, date: "2026-05-08", user }`
- THEN la pantalla de Alice no cambia

#### Scenario: Asignación fija propaga a cualquier día
- GIVEN Alice ve el día `2026-05-04`
- WHEN llega `{ type: "desk.fixed", deskId: A1.id, user }`
- THEN A1 se renderiza como fijo en la vista de Alice
