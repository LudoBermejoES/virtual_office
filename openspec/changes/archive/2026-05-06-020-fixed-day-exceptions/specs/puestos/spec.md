# Puestos

## ADDED Requirements

### Requirement: Excepción puntual por día en un puesto fijo

El servidor SHALL permitir al titular de una asignación fija o a un admin (global o office-admin de la oficina propietaria) registrar una excepción para una fecha concreta, que libera ese puesto para ese día sin alterar la asignación fija subyacente.

#### Scenario: Titular crea excepción para hoy

- **WHEN** un usuario titular del fijo en el desk D envía `POST /api/desks/D/fixed/skip` con `{ date: <hoy> }`
- **THEN** el servidor responde `200 { exception }` y el snapshot de la oficina para esa fecha deja de incluir ese fijo

#### Scenario: Admin crea excepción para otro usuario

- **WHEN** un admin envía `POST /api/desks/D/fixed/skip` con `{ date: <futuro> }` y D pertenece a un fijo de otro usuario
- **THEN** el servidor responde `200` y la excepción queda registrada

#### Scenario: Member sin permisos

- **WHEN** un usuario que no es titular ni admin envía la petición
- **THEN** la respuesta es `403 not_authorized`

#### Scenario: Fecha pasada rechazada

- **WHEN** se envía `{ date: <ayer> }`
- **THEN** la respuesta es `400 date_in_past`

#### Scenario: Fecha fuera del horizonte

- **WHEN** se envía una fecha más allá de `BOOKING_HORIZON_DAYS`
- **THEN** la respuesta es `400 date_out_of_horizon`

#### Scenario: Desk sin fijo

- **WHEN** el desk no tiene asignación fija
- **THEN** la respuesta es `404 fixed_not_found`

#### Scenario: Idempotencia

- **WHEN** se envía dos veces seguidas el mismo `{ date }`
- **THEN** la segunda respuesta es `200` con la misma excepción, sin error

### Requirement: Borrar excepción de día

El servidor SHALL permitir al titular o admin eliminar una excepción previamente registrada, restaurando el puesto fijo para ese día.

#### Scenario: Titular deshace su excepción

- **WHEN** el titular envía `DELETE /api/desks/D/fixed/skip` con `{ date }` correspondiente a una excepción existente
- **THEN** el servidor responde `204` y el snapshot vuelve a incluir el fijo

#### Scenario: Admin deshace excepción de otro

- **WHEN** un admin envía DELETE para una excepción existente de otro usuario
- **THEN** la respuesta es `204`

#### Scenario: Member sin permisos

- **WHEN** un member envía DELETE
- **THEN** la respuesta es `403 not_authorized`

#### Scenario: Excepción inexistente

- **WHEN** se envía DELETE para `{date}` sin excepción registrada
- **THEN** la respuesta es `404 not_found`

### Requirement: Snapshot omite fijos con excepción para esa fecha

El servidor SHALL excluir del snapshot diario los fijos que tengan una excepción registrada para la fecha consultada.

#### Scenario: Excepción presente

- **WHEN** existe un fijo (desk D, user U) y una excepción para la fecha X
- **WHEN** un cliente solicita `GET /api/offices/:id?date=X`
- **THEN** la respuesta no incluye booking alguno asociado al desk D por ese fijo (puede haber otra `daily` distinta)

#### Scenario: Excepción solo afecta su día

- **WHEN** existe excepción para la fecha X y el cliente consulta la fecha X+1
- **THEN** el snapshot de X+1 incluye el fijo normalmente

#### Scenario: Daily prevalece sobre fijo con excepción

- **WHEN** un usuario reserva una `daily` en el desk D para la fecha X mientras existe una excepción del fijo en D para X
- **THEN** el snapshot incluye únicamente la `daily`; el fijo y la excepción no aparecen como bookings

### Requirement: Snapshot indica si tengo mi propio fijo con excepción

El servidor SHALL incluir en `GET /api/offices/:id?date=X` el campo opcional `myFixedExceptionDeskId: number | null` indicando, si el usuario solicitante tiene un fijo en esa oficina y una excepción activa para la fecha X, el `deskId` correspondiente.

#### Scenario: Tengo fijo y excepción para X

- **WHEN** el usuario tiene un fijo en desk D y una excepción para X
- **THEN** la respuesta incluye `myFixedExceptionDeskId: D`

#### Scenario: Tengo fijo sin excepción

- **WHEN** el usuario tiene un fijo pero no excepción para X
- **THEN** `myFixedExceptionDeskId` es `null`

#### Scenario: No tengo fijo

- **WHEN** el usuario no tiene fijo en esa oficina
- **THEN** `myFixedExceptionDeskId` es `null`
