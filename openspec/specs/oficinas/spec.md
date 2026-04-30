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

### Requirement: Subida del mapa Tiled de la oficina
El sistema MUST permitir a un administrador subir el mapa de una oficina como un bundle Tiled compuesto por un fichero `.tmj` (Tiled JSON, version 1.10+, orthogonal, tilesets embebidos, sin compresión) y los ficheros de imagen referenciados por sus tilesets (PNG o WebP). El upload total MUST estar limitado a 10 MB; el `.tmj` a 1 MB; cada tileset a 2 MB.

#### Scenario: Subida de bundle Tiled válido
- GIVEN un admin autenticado
- AND un fichero `office.tmj` válido (orthogonal, version 1.10, 1 tileset embebido `office_tiles.png`, 1 tile layer csv) con `tilewidth=32`, `tileheight=32`, `width=20`, `height=15`
- AND un PNG `office_tiles.png` de 256×256
- WHEN solicita `POST /api/offices` multipart con `name="HQ"`, `tmj=office.tmj`, `tilesets=[office_tiles.png]`
- THEN la respuesta es 201 con `{ office: { id, name, tile_width: 32, tile_height: 32, cells_x: 20, cells_y: 15, map_width: 640, map_height: 480, tilesets: [{ ordinal: 0, image_name: "office_tiles.png" }] } }`
- AND el `.tmj` queda guardado en `OFFICE_MAPS_DIR/{officeId}/map_{sha256[:12]}.tmj`
- AND el PNG queda guardado en `OFFICE_MAPS_DIR/{officeId}/tile_0_{sha256[:12]}.png`

#### Scenario: tmj malformado
- GIVEN un admin
- WHEN sube como `tmj` un JSON inválido o que no cumple el schema Tiled
- THEN la respuesta es 422 con `reason: "invalid_tmj"`
- AND nada queda persistido en disco ni en DB

#### Scenario: Versión Tiled no soportada
- GIVEN un admin
- WHEN sube un `.tmj` con `version: "1.9"`
- THEN la respuesta es 422 con `reason: "tiled_version_unsupported"`

#### Scenario: Orientación no soportada
- GIVEN un admin
- WHEN sube un mapa con `orientation: "isometric"`
- THEN la respuesta es 422 con `reason: "orientation_unsupported"`

#### Scenario: Tile layer comprimido
- GIVEN un admin
- WHEN sube un `.tmj` con un tile layer cuyo `compression` es `"zlib"`, `"gzip"` o `"zstd"`
- THEN la respuesta es 422 con `reason: "compression_unsupported"`

#### Scenario: Tileset externo no embebido
- GIVEN un admin
- WHEN sube un `.tmj` cuyo tileset usa `source: "tiles.tsj"` en lugar de embeber
- THEN la respuesta es 422 con `reason: "external_tilesets_unsupported"`

#### Scenario: Tileset faltante
- GIVEN un `.tmj` que referencia `office_tiles.png` y `walls.png`
- WHEN se sube solo el `.tmj` y `office_tiles.png`
- THEN la respuesta es 422 con `reason: "tileset_mismatch"` y `details` mencionando `walls.png` como missing

#### Scenario: Tileset extra no referenciado
- GIVEN un `.tmj` que referencia solo `office_tiles.png`
- WHEN se sube `.tmj` + `office_tiles.png` + `extra.png`
- THEN la respuesta es 422 con `reason: "tileset_mismatch"` y `details` mencionando `extra.png` como extra

#### Scenario: Tileset con MIME no permitido
- GIVEN un admin
- WHEN un tileset adjunto es JPEG o GIF
- THEN la respuesta es 415 con `reason: "unsupported_media_type"`

#### Scenario: Tileset demasiado pequeño
- GIVEN un `.tmj` con `tilewidth=32`, `tileheight=32`
- WHEN se sube un tileset PNG de 24×24
- THEN la respuesta es 422 con `reason: "tileset_too_small"`

#### Scenario: Mapa de dimensiones excesivas
- GIVEN un admin
- WHEN sube un `.tmj` cuyas dimensiones totales (`cells × tile`) superan 4096 px en alguna dimensión
- THEN la respuesta es 422 con `reason: "map_too_large"`

#### Scenario: Tamaño total excedido
- GIVEN un admin
- WHEN el conjunto multipart supera 10 MB
- THEN la respuesta es 413
- AND nada queda persistido

#### Scenario: Member intenta subir mapa
- GIVEN un usuario `member`
- WHEN solicita `POST /api/offices`
- THEN la respuesta es 403

### Requirement: Reemplazo del bundle Tiled
El sistema MUST permitir al admin reemplazar el bundle Tiled de una oficina, regenerando los filenames con sus nuevos hashes y persistiendo la nueva lista de tilesets. Los desks existentes NO MUST modificarse automáticamente al reemplazar el bundle.

#### Scenario: PATCH reemplaza tmj y tilesets
- GIVEN una oficina con un bundle Tiled previo
- WHEN un admin envía `PATCH /api/offices/:id` con un nuevo `.tmj` y nuevos tilesets coherentes
- THEN la respuesta es 200
- AND la oficina apunta a los nuevos filenames y a la nueva lista de `office_tilesets`
- AND los desks existentes mantienen sus coordenadas

### Requirement: Servido inmutable de bundle Tiled
El sistema MUST servir el `.tmj` y los tilesets bajo `/maps/:officeId/:filename` con caché agresiva inmutable y filename validado contra path traversal.

#### Scenario: Cache headers en `.tmj`
- GIVEN un mapa subido
- WHEN un cliente solicita `GET /maps/{officeId}/{tmj_filename}`
- THEN la respuesta es 200 con `Cache-Control: public, max-age=31536000, immutable`
- AND incluye `X-Content-Type-Options: nosniff`
- AND el `Content-Type` es `application/json`

#### Scenario: Cache headers en tileset
- GIVEN un tileset PNG persistido
- WHEN un cliente solicita `GET /maps/{officeId}/tile_0_xxx.png`
- THEN la respuesta es 200 con `Content-Type: image/png` y los mismos headers de caché

#### Scenario: Path traversal bloqueado
- GIVEN un cliente malicioso
- WHEN solicita `GET /maps/1/..%2F..%2Fetc%2Fpasswd`
- THEN la respuesta es 400 sin tocar el disco

#### Scenario: Filename con extensión no permitida
- GIVEN un cliente
- WHEN solicita `GET /maps/1/foo.exe`
- THEN la respuesta es 400

### Requirement: Listado y consulta de oficinas
El sistema MUST permitir a cualquier usuario autenticado listar oficinas y consultar el detalle de una oficina concreta, incluyendo el array de tilesets necesarios para reconstruir el tilemap en el cliente, los puestos definidos sobre el mapa con sus coordenadas y origen, y, cuando se especifica `?date=YYYY-MM-DD`, las reservas de ese día con datos públicos del usuario que reservó (incluido `avatar_url`).

#### Scenario: Listado autenticado
- GIVEN un usuario autenticado
- WHEN solicita `GET /api/offices`
- THEN la respuesta es 200 con array de oficinas (puede ser vacío); cada elemento incluye `tilesets`

#### Scenario: Detalle con tilesets y desks vacíos
- GIVEN una oficina recién creada sin desks aún
- WHEN se consulta `GET /api/offices/:id`
- THEN la respuesta incluye `office` con sus campos Tiled, `tilesets: [{ ordinal, image_name, filename }]` y `desks: []`

#### Scenario: Detalle con desks de ambos orígenes
- GIVEN una oficina con dos puestos: uno importado desde Tiled, otro creado manualmente
- WHEN un usuario autenticado solicita `GET /api/offices/:id`
- THEN la respuesta incluye `office` y `desks: [{ id, label, x, y, source }]` con dos elementos
- AND los valores de `source` incluyen `"tiled"` y `"manual"` respectivamente

#### Scenario: Detalle con reservas del día
- GIVEN una oficina con dos puestos y una reserva de Alice en A1 para `2026-05-04`
- WHEN un usuario autenticado solicita `GET /api/offices/:id?date=2026-05-04`
- THEN la respuesta incluye `office`, `desks` con dos elementos, y `bookings: [{ id, deskId, userId, type, user: { id, name, avatar_url } }]` con la reserva de Alice
- AND el `avatar_url` proviene del campo `picture` del ID token de Google de Alice (persistido en `users.avatar_url` durante el login)

#### Scenario: Detalle sin parámetro date
- GIVEN una oficina con reservas en distintos días
- WHEN un usuario autenticado solicita `GET /api/offices/:id` sin `?date=`
- THEN la respuesta incluye solo las reservas correspondientes al día actual del servidor en UTC

#### Scenario: Sin autenticación
- GIVEN un cliente sin cookie
- WHEN solicita `GET /api/offices`
- THEN la respuesta es 401
