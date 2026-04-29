# Delta — Oficinas

## ADDED Requirements

### Requirement: Estado de salud reportable
El sistema MUST exponer un endpoint público que reporte el estado del proceso, de la base de datos y de la observabilidad sin requerir autenticación.

#### Scenario: Health check con DB sana
- GIVEN el servidor arrancado y la base de datos accesible
- WHEN un cliente solicita `GET /healthz`
- THEN la respuesta es 200
- AND el body contiene `{ status: "ok", db: "ok" }`
- AND el campo `sentry` indica `"on"` u `"off"` según haya `SENTRY_DSN`

#### Scenario: Health check con DB caída
- GIVEN el servidor arrancado y la base de datos inaccesible
- WHEN un cliente solicita `GET /healthz`
- THEN la respuesta es 503
- AND el body contiene `{ status: "degraded", db: "down" }`

### Requirement: Esquema base de datos versionado
El sistema MUST aplicar migraciones SQL versionadas e idempotentes al arrancar y registrar cada versión aplicada en una tabla `_migrations`. La migración inicial MUST crear las tablas `users`, `offices` (con campos del mapa Tiled: `tmj_filename`, `tile_width`, `tile_height`, `cells_x`, `cells_y`, `map_width`, `map_height`), `office_tilesets` (1:N con `offices`), `desks` (con coordenadas `x` y `y` enteras), `bookings` e `invitations` con sus restricciones e índices.

#### Scenario: Primer arranque sin DB
- GIVEN no existe el fichero de base de datos
- WHEN el servidor arranca
- THEN se crea la base de datos
- AND se aplican todas las migraciones pendientes en orden
- AND la tabla `_migrations` contiene una fila por cada versión aplicada

#### Scenario: Arranque con migraciones ya aplicadas
- GIVEN una base de datos con todas las migraciones registradas
- WHEN el servidor arranca de nuevo
- THEN no se vuelve a aplicar ninguna migración
- AND el contenido de las tablas existentes no se altera
