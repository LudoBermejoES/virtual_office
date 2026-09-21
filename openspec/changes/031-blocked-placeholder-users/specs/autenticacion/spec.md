# Autenticación — Delta para change 031-blocked-placeholder-users

## ADDED Requirements

### Requirement: Usuarios placeholder "Bloqueado"

El sistema MUST mantener exactamente tres usuarios placeholder sembrados por migración (`Bloqueado #1`, `Bloqueado #2`, `Bloqueado #3`) marcados con `is_placeholder = 1`. Estos usuarios existen para que un admin pueda bloquear un puesto sin ponerle encima a una persona real. Son filas de `users` ordinarias en todo lo demás, de forma que respetan sin excepciones las reglas de unicidad de reservas diarias, fijos y recurrencias semanales.

#### Scenario: Migración siembra los tres placeholders

- **GIVEN** una base de datos con el esquema previo al change 031
- **WHEN** se ejecuta la migración `0010_placeholder_users.sql`
- **THEN** la tabla `users` tiene la columna `is_placeholder` con `DEFAULT 0`
- **AND** existen exactamente tres filas con `is_placeholder = 1`
- **AND** sus `name` son `Bloqueado #1`, `Bloqueado #2` y `Bloqueado #3`
- **AND** sus `google_sub` son `placeholder:1`, `placeholder:2` y `placeholder:3`
- **AND** su `role` es `member` y su `is_invited_external` es `0`

#### Scenario: Usuarios existentes no quedan marcados como placeholder

- **GIVEN** una base de datos con usuarios reales previos al change
- **WHEN** se ejecuta la migración `0010_placeholder_users.sql`
- **THEN** todos los usuarios preexistentes tienen `is_placeholder = 0`

#### Scenario: Seed idempotente

- **GIVEN** una base de datos que ya tiene los tres placeholders sembrados
- **WHEN** se vuelve a ejecutar el `INSERT` del seed
- **THEN** siguen existiendo exactamente tres filas con `is_placeholder = 1`
- **AND** no se lanza error de violación de unicidad

### Requirement: Los placeholders nunca pueden iniciar sesión

El sistema MUST rechazar cualquier intento de login que resuelva a un usuario con `is_placeholder = 1`, independientemente de los dominios permitidos configurados. El `google_sub` sintético y el dominio fuera de `TEIMAS_DOMAINS` son salvaguardas adicionales, no la única defensa.

#### Scenario: Login que resuelve a un placeholder

- **GIVEN** un ID token válido y verificado cuyo email coincide con el de un placeholder
- **AND** el dominio de ese email está, hipotéticamente, en `TEIMAS_DOMAINS`
- **WHEN** se envía `POST /api/auth/google { idToken }`
- **THEN** la respuesta es 403 con `reason: "placeholder_cannot_login"`
- **AND** no se emite cookie de sesión
- **AND** la fila del placeholder no se modifica
- **AND** el log incluye `auth.rejected` con `reason: "placeholder_cannot_login"` y sin el email completo

#### Scenario: El upsert de Google no colisiona con un placeholder

- **GIVEN** los tres placeholders con `google_sub` `placeholder:1..3`
- **WHEN** un empleado real hace login con un ID token cuyo `sub` es una cadena numérica de Google
- **THEN** se crea o actualiza su propia fila
- **AND** las filas de los placeholders quedan intactas

#### Scenario: Dominio del placeholder no está permitido

- **GIVEN** `TEIMAS_DOMAINS` con los dominios reales de Teimas
- **WHEN** se intenta login con un ID token cuyo email es `bloqueado1@teimas.space` y sin `inviteToken`
- **THEN** la respuesta es 403
- **AND** no se abre sesión

### Requirement: Los placeholders no son gestionables como personas

El sistema MUST impedir que un placeholder sea promovido, degradado o invitado. Un admin SÍ MAY subirle un avatar custom, porque es el mecanismo previsto para darle icono propio en el mapa.

#### Scenario: Admin intenta cambiar el rol de un placeholder

- **GIVEN** un admin autenticado y el id de `Bloqueado #1`
- **WHEN** envía `PATCH /api/users/<idPlaceholder>` con `{ role: "admin" }`
- **THEN** la respuesta es 409 con `reason: "cannot_modify_placeholder"`
- **AND** el `role` del placeholder sigue siendo `member`

#### Scenario: Admin cambia el rol de un usuario inexistente

- **GIVEN** un admin autenticado
- **WHEN** envía `PATCH /api/users/<idInexistente>` con `{ role: "admin" }`
- **THEN** la respuesta es 404 con `reason: "user_not_found"`
- **AND** no se ejecuta ningún `UPDATE`

#### Scenario: Admin intenta invitar el email de un placeholder

- **GIVEN** un admin autenticado
- **WHEN** envía `POST /api/invitations` con `{ email: "bloqueado1@teimas.space" }`
- **THEN** la respuesta es 422 con `reason: "cannot_invite_placeholder"`
- **AND** no se crea ninguna fila en `invitations`

#### Scenario: Admin sube avatar custom a un placeholder

- **GIVEN** un admin autenticado y el id de `Bloqueado #1`
- **WHEN** envía `POST /api/users/<idPlaceholder>/avatar` con un PNG válido
- **THEN** la respuesta es 200
- **AND** el `avatar_url` del placeholder apunta a `/avatars/<id>_<hash8>.png`
- **AND** `avatar_locked` queda en `1`

### Requirement: Visibilidad selectiva de los placeholders en el listado de usuarios

El sistema MUST excluir los placeholders de `GET /api/users` por defecto, y MUST incluirlos cuando se pida explícitamente con `?includePlaceholders=1`. Cuando se incluyen, van ordenados después de los usuarios reales.

#### Scenario: Listado por defecto no incluye placeholders

- **GIVEN** un admin autenticado y una base con dos usuarios reales y los tres placeholders
- **WHEN** solicita `GET /api/users`
- **THEN** la respuesta es 200 con exactamente los dos usuarios reales
- **AND** ningún elemento tiene `is_placeholder = 1`

#### Scenario: Listado con includePlaceholders

- **GIVEN** un admin autenticado y una base con dos usuarios reales y los tres placeholders
- **WHEN** solicita `GET /api/users?includePlaceholders=1`
- **THEN** la respuesta es 200 con cinco elementos
- **AND** los tres placeholders van al final del array
- **AND** cada placeholder incluye `is_placeholder: 1`

#### Scenario: Filtro por email de un placeholder

- **GIVEN** un admin autenticado
- **WHEN** solicita `GET /api/users?email=bloqueado1@teimas.space`
- **THEN** la respuesta es 200 con el placeholder correspondiente
- **AND** el elemento incluye `is_placeholder: 1`

#### Scenario: Member intenta listar usuarios

- **GIVEN** un usuario con `role="member"`
- **WHEN** solicita `GET /api/users?includePlaceholders=1`
- **THEN** la respuesta es 403

### Requirement: El listado de usuarios puede anotar quién ya tiene reserva diaria

El sistema MUST aceptar un parámetro `date` en `GET /api/users` y, cuando se envía, anotar cada elemento con `has_daily_booking`. El cálculo MUST cubrir todas las oficinas y MUST contar solo reservas de tipo `daily`, porque ése es exactamente el alcance del índice único `(user_id, date)` que provoca el 409 `user_already_booked_today`.

#### Scenario: Placeholder con reserva daily en otra oficina

- **GIVEN** un admin autenticado y `Bloqueado #1` con una reserva daily en la oficina B para la fecha `D`
- **WHEN** solicita `GET /api/users?includePlaceholders=1&date=D`
- **THEN** la respuesta es 200 y el elemento de `Bloqueado #1` incluye `has_daily_booking: 1`
- **AND** `Bloqueado #2` y `Bloqueado #3` incluyen `has_daily_booking: 0`

#### Scenario: Una reserva fixed no consume el cupo diario

- **GIVEN** un admin autenticado y `Bloqueado #1` con una reserva de tipo `fixed` para la fecha `D`
- **WHEN** solicita `GET /api/users?includePlaceholders=1&date=D`
- **THEN** el elemento de `Bloqueado #1` incluye `has_daily_booking: 0`

#### Scenario: Sin date no se anota nada

- **GIVEN** un admin autenticado
- **WHEN** solicita `GET /api/users?includePlaceholders=1` sin `date`
- **THEN** ningún elemento incluye la clave `has_daily_booking`

#### Scenario: Fecha malformada

- **GIVEN** un admin autenticado
- **WHEN** solicita `GET /api/users?date=2026-13-45`
- **THEN** la respuesta es 400 con `reason: "bad_request"`
