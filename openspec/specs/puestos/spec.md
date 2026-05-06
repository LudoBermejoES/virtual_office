# Puestos

## Purpose

Define los puestos de trabajo (desks) dentro de una oficina: su posición en el mapa, su nombre, su origen (manual o extraído del .tmj de Tiled) y las reglas de creación, edición y borrado por parte de administradores.

## Requirements


### Requirement: Creación manual de puesto por coordenada
El sistema MUST permitir a un administrador crear un puesto definido por una única coordenada `(x, y)` sobre el mapa de la oficina. El render del puesto se hace como un cuadrado de ancho fijo `DESK_SIZE_PX` centrado en ese punto. Los puestos creados por esta vía MUST quedar persistidos con `source = "manual"`.

#### Scenario: Punto válido dentro del mapa
- GIVEN una oficina con mapa de 800×600 sin desks aún
- AND un admin autenticado
- WHEN solicita `POST /api/offices/:id/desks { label: "A1", x: 160, y: 110 }`
- THEN la respuesta es 201 con `{ id, label: "A1", x: 160, y: 110 }`
- AND la fila se persiste con coords enteras

#### Scenario: Punto fuera del mapa
- GIVEN un mapa de 800×600
- WHEN un admin envía `{ label: "A1", x: 850, y: 110 }`
- THEN la respuesta es 422 con `reason: "out_of_bounds"`

#### Scenario: Punto demasiado cerca de otro puesto
- GIVEN un puesto existente en `(160, 110)`
- AND `DESK_MIN_SEPARATION = 52`
- WHEN un admin intenta crear otro puesto en `(170, 120)` (Chebyshev=10)
- THEN la respuesta es 422 con `reason: "too_close_to_existing"`

#### Scenario: Punto a separación exacta
- GIVEN un puesto existente en `(160, 110)`
- WHEN un admin crea otro puesto en `(212, 110)` (Chebyshev=52)
- THEN la respuesta es 201

#### Scenario: Etiqueta duplicada en la misma oficina
- GIVEN un desk con `label="A1"` en la oficina X
- WHEN el admin envía otro desk con el mismo label en X
- THEN la respuesta es 409 con `reason: "label_taken"`

#### Scenario: Etiqueta duplicada en oficinas distintas permitida
- GIVEN un desk con `label="A1"` en X y otra oficina Y
- WHEN el admin crea desk con `label="A1"` en Y
- THEN la respuesta es 201

#### Scenario: Oficina llena
- GIVEN una oficina con `MAX_DESKS_PER_OFFICE` desks
- WHEN un admin intenta crear uno más
- THEN la respuesta es 422 con `reason: "office_full"`

#### Scenario: Member intenta crear desk
- GIVEN un usuario `member`
- WHEN solicita `POST /api/offices/:id/desks`
- THEN la respuesta es 403

### Requirement: Modificación de puesto
El sistema MUST permitir a un admin actualizar la etiqueta o las coordenadas de un puesto, manteniendo las mismas validaciones que en la creación.

#### Scenario: PATCH cambia label
- GIVEN un desk con `label="A1"`
- WHEN un admin envía `PATCH /api/desks/:id { label: "ZONA_DIRECCION" }`
- THEN la respuesta es 200 y el label se actualiza

#### Scenario: PATCH mueve coordenadas
- GIVEN un desk en `(160, 110)`
- AND otro desk a separación válida
- WHEN un admin envía `PATCH /api/desks/:id { x: 220, y: 110 }`
- THEN la respuesta es 200 y las coords se actualizan

#### Scenario: PATCH a posición demasiado cerca de otro
- GIVEN dos desks separados a `DESK_MIN_SEPARATION + 5`
- WHEN un admin intenta mover uno a 10 px del otro
- THEN la respuesta es 422 con `reason: "too_close_to_existing"`
- AND el desk no se modifica

### Requirement: Borrado de puesto
El sistema MUST permitir a un admin borrar un puesto, independientemente de su `source`.

#### Scenario: DELETE
- GIVEN un desk sin reservas asociadas
- WHEN un admin envía `DELETE /api/desks/:id`
- THEN la respuesta es 204
- AND el desk desaparece del listado

### Requirement: Importación automática desde object layer Tiled "desks"
El sistema MUST extraer y persistir como puestos los objetos del object layer llamado `desks` del `.tmj` cuando se sube o reemplaza el bundle Tiled, marcando los puestos resultantes con `source = "tiled"`. Los objetos que no superen la validación geométrica MUST reportarse como warnings sin abortar la subida.

#### Scenario: Object layer con points
- GIVEN un admin sube un `.tmj` con un object layer llamado `desks` con 3 objetos `point: true` (`name="A1"`, `name="A2"`, `name="A3"`) en coordenadas válidas
- WHEN se procesa el upload
- THEN se crean 3 desks con `source="tiled"` y los labels indicados
- AND la respuesta incluye `desksImported: 3` y `desksWarnings: []`

#### Scenario: Object layer con rectángulos
- GIVEN un object layer `desks` con un rectángulo `name="B1"`, `x=100`, `y=100`, `width=40`, `height=40`
- WHEN se sube el `.tmj`
- THEN se crea un desk con `label="B1"`, `x=120`, `y=120` (centro del rectángulo) y `source="tiled"`

#### Scenario: Objeto sin name
- GIVEN un object layer `desks` con un point sin `name`
- WHEN se procesa el upload
- THEN el desk se crea con label autogenerado siguiendo el patrón `T1`, `T2`, ...

#### Scenario: Objeto polígono ignorado
- GIVEN un object layer `desks` con un objeto polígono
- WHEN se procesa el upload
- THEN ese objeto NO se crea como desk
- AND aparece en `desksWarnings` con `reason: "unsupported_object_type"`

#### Scenario: Object con coords fuera del mapa
- GIVEN un point con `x = mapWidth + 10`
- WHEN se procesa el upload
- THEN el desk NO se crea
- AND aparece en `desksWarnings` con `reason: "out_of_bounds"`

#### Scenario: Object con label colisionando con manual existente
- GIVEN un desk manual con label `"A1"` ya en la oficina
- AND un object del layer `desks` también con `name="A1"`
- WHEN se procesa el upload
- THEN el desk del Tiled NO se crea
- AND aparece en `desksWarnings` con `reason: "label_taken"`

#### Scenario: Ausencia de object layer "desks"
- GIVEN un `.tmj` que NO contiene un object layer llamado `desks`
- WHEN se sube
- THEN no se crea ningún desk automáticamente
- AND `desksImported` es 0

### Requirement: Re-importación manual desde Tiled
El sistema MUST permitir al admin pedir explícitamente la re-importación de los puestos desde el object layer Tiled del `.tmj` actual mediante `POST /api/offices/:id/desks/import-from-tiled`. La operación MUST ser idempotente: NUNCA MUST sobreescribir desks existentes con `source="manual"` ni duplicar desks `source="tiled"` que ya tengan el mismo label.

#### Scenario: Re-importación añade solo lo nuevo
- GIVEN una oficina con un `.tmj` que tenía 2 points "A1", "A2" ya importados
- AND el admin sube un nuevo `.tmj` mediante PATCH que ahora trae también un punto "A3" (PATCH no toca desks existentes)
- WHEN ejecuta `POST /api/offices/:id/desks/import-from-tiled`
- THEN se importa "A3" con `source="tiled"`
- AND "A1" y "A2" no se modifican
- AND la respuesta es `{ imported: 1, warnings: [] }`

#### Scenario: Re-importación con colisión manual
- GIVEN un desk manual con label `"A4"`
- AND el `.tmj` actual incluye un point `name="A4"`
- WHEN admin ejecuta `import-from-tiled`
- THEN no se crea un nuevo desk
- AND la respuesta incluye `warnings: [{ label: "A4", reason: "label_taken_by_manual" }]`

#### Scenario: Member intenta re-importar
- GIVEN un usuario `member`
- WHEN solicita `POST /api/offices/:id/desks/import-from-tiled`
- THEN la respuesta es 403

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

