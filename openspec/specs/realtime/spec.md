# Realtime


## Requirement: Canal WebSocket por oficina autenticado
El sistema MUST exponer un endpoint WebSocket por oficina que solo acepte conexiones con cookie de sesión válida y que difunda en tiempo real los cambios de ocupación a todos los suscriptores de esa oficina.

#### Scenario: Conexión sin cookie
- GIVEN un cliente que abre `/ws/offices/:id` sin cookie de sesión
- WHEN intenta el upgrade
- THEN el servidor cierra el socket con código 4001 antes de enviar mensajes

#### Scenario: Conexión con cookie válida
- GIVEN un usuario autenticado
- WHEN abre `/ws/offices/:id`
- THEN el socket se mantiene abierto
- AND el primer mensaje recibido es `{ type: "snapshot.ts", at: <ISO8601> }`

## Requirement: Broadcast de reservas diarias
El sistema MUST emitir un mensaje `desk.booked` o `desk.released` a todos los clientes conectados a la oficina cuando un puesto se reserva o libera para una fecha.

#### Scenario: Reserva propaga
- GIVEN dos clientes Alice y Bob conectados a la oficina X
- WHEN Alice reserva A1 para `2026-05-04`
- THEN Bob recibe en su WS un mensaje `{ type: "desk.booked", deskId: A1.id, date: "2026-05-04", user: { id, name, avatar_url } }`

#### Scenario: Liberación propaga
- GIVEN dos clientes conectados
- WHEN Alice libera A1 del `2026-05-04`
- THEN ambos reciben `{ type: "desk.released", deskId: A1.id, date: "2026-05-04" }`

## Requirement: Broadcast de asignaciones fijas
El sistema MUST emitir `desk.fixed` o `desk.unfixed` cuando un admin asigna o retira la asignación fija de un puesto.

#### Scenario: Asignación fija propaga
- GIVEN dos clientes conectados
- WHEN un admin asigna a Bob como fijo de A1
- THEN ambos reciben `{ type: "desk.fixed", deskId: A1.id, user: { id: Bob.id, name, avatar_url } }`

#### Scenario: Retirada de fijo propaga
- GIVEN dos clientes conectados
- WHEN un admin retira el fijo de A1
- THEN ambos reciben `{ type: "desk.unfixed", deskId: A1.id }`

## Requirement: Broadcast de cambios estructurales
El sistema MUST emitir `office.updated` cuando se sube o reemplaza el mapa de la oficina, o se crean/borran/modifican puestos.

#### Scenario: Cambio del mapa propaga
- GIVEN dos clientes conectados
- WHEN un admin reemplaza el mapa con `PATCH /api/offices/:id`
- THEN ambos reciben `{ type: "office.updated", officeId }`

## Requirement: Reconexión segura del cliente
El sistema MUST permitir al cliente reconectarse con backoff exponencial tras una desconexión imprevista, salvo en cierres de autorización (código 4001) que MUST NOT reintentarse.

#### Scenario: Cierre por desconexión de red
- GIVEN un cliente con WS abierto
- WHEN la conexión se cierra con código 1006
- THEN el cliente reintenta tras 1 s y multiplica el delay por 2 hasta 30 s tope

#### Scenario: Cierre por sesión expirada
- GIVEN un cliente con WS abierto cuya sesión expira
- WHEN el server cierra con código 4001
- THEN el cliente NO reintenta y redirige a `LoginScene`

## Requirement: Heartbeat
El sistema MUST cerrar conexiones inactivas tras un periodo de silencio (60 s sin tráfico).

#### Scenario: Cliente silente
- GIVEN una WS conectada sin mensajes durante 60 s
- WHEN se cumple el timeout
- THEN el server cierra con código 4002
- AND el cliente reconecta tras backoff
