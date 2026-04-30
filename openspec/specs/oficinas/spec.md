# Oficinas

## Purpose

Modela las oficinas físicas de Teimas como entidades en el sistema, su mapa Tiled (tilemap + tilesets), su estado de salud y los cimientos de persistencia. Es la base sobre la que se montan puestos, reservas y vista realtime.

## Requirements


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

### Requirement: Object layers extra del mapa Tiled
El sistema MUST aceptar y procesar las object layers `zones`, `rooms` y `labels` del fichero `.tmj` cuando estén presentes. Estas layers son opcionales: una oficina sin ellas sigue siendo válida. Cada feature MUST tener un `name` ≤ 80 caracteres ASCII/Unicode latino y, según su kind, propiedades específicas.

#### Scenario: Mapa con zona "Cocina"
- GIVEN un `.tmj` que contiene una object layer `zones` con un rectángulo `name="Cocina"` y `properties.kind="kitchen"`
- WHEN el admin sube el bundle Tiled vía `POST /api/offices`
- THEN el sistema persiste una fila en `office_features` con `kind="zone"` y `name="Cocina"`
- AND `GET /api/offices/:id` incluye esta zona en `features.zones`

#### Scenario: Mapa con polígono cóncavo
- GIVEN un `.tmj` con una zona definida por un polígono de 6 puntos
- WHEN se sube el mapa
- THEN el polígono se persiste con coordenadas absolutas (sumando el origen del objeto)
- AND `features.zones[i].geometry` es `{ type: "polygon", points: [{x,y}, ...] }`

#### Scenario: Mapa sin object layers extra
- GIVEN un `.tmj` con solo la layer `desks`
- WHEN se sube el mapa
- THEN `features` viene como `{ zones: [], rooms: [], labels: [] }`

### Requirement: Validación de features
El sistema MUST rechazar el bundle si alguna feature tiene `name` con caracteres de control, `kind` fuera del enum, geometría fuera del rango del mapa, polígono con menos de 3 o más de 64 puntos, o si el total de features supera 200.

#### Scenario: Feature con kind inválido
- GIVEN un `.tmj` con una zona cuyo `kind="restroom"` (no está en el enum)
- WHEN se sube el bundle
- THEN la respuesta es 400 con `reason="invalid_feature_kind"`

#### Scenario: Polígono fuera del mapa
- GIVEN un `.tmj` con un polígono que tiene un punto en `x = mapWidth + 10`
- WHEN se sube el bundle
- THEN la respuesta es 400 con `reason="feature_out_of_bounds"`

#### Scenario: Más de 200 features
- GIVEN un `.tmj` con 201 zonas
- WHEN se sube el bundle
- THEN la respuesta es 413 con `reason="too_many_features"`

### Requirement: Renderizado de zonas en OfficeScene
El sistema MUST dibujar las zonas y rooms como polígonos semi-transparentes (alpha 0.15) por debajo de los desks (depth -10), con el color asociado al `kind` derivado del tema arcade. Las labels MUST renderizarse con la fuente `Press Start 2P` o `VT323` según `properties.font`.

#### Scenario: Zona cocina visible
- GIVEN una oficina con una zona `kind="kitchen"`
- WHEN un usuario abre `OfficeScene`
- THEN se dibuja un rectángulo con relleno `THEME.warning` alpha 0.15
- AND el rectángulo está por debajo de los desks (depth -10)

#### Scenario: Label con fuente display
- GIVEN una oficina con una label `name="Mar"`, `font="display"`, `size=24`
- WHEN se renderiza la escena
- THEN aparece el texto "Mar" con `fontFamily: "Press Start 2P"` y `fontSize: "24px"`

### Requirement: Indicador de zona actual
El sistema MUST mostrar en el HUD el nombre de la zona que contiene el puntero del ratón cuando el cursor está sobre una zona o room nombrados, y MUST limpiar el indicador cuando el cursor sale de cualquier zona.

#### Scenario: Hover sobre zona Cocina
- GIVEN una oficina con una zona `name="Cocina"`
- WHEN el usuario mueve el ratón sobre el área de Cocina
- THEN el HUD muestra "📍 Cocina"

#### Scenario: Salir de cualquier zona
- GIVEN el cursor estaba sobre una zona y se mueve fuera
- WHEN no contiene ninguna zona
- THEN el indicador del HUD queda vacío

### Requirement: Selector de oficina en HUD
El sistema MUST mostrar en el HUD un selector con el nombre de la oficina actual y un menú con todas las oficinas a las que el usuario tiene acceso. Al cambiar de oficina, el sistema MUST cerrar el WebSocket anterior, abrir el nuevo, refrescar el snapshot y persistir el id en `localStorage` con clave `vo_last_office`.

#### Scenario: Cambio de oficina
- GIVEN un usuario con acceso a las oficinas Compostela (id=1) y Madrid (id=2), actualmente en Compostela
- WHEN abre el selector y elige Madrid
- THEN la `OfficeScene` se reinicia con `officeId=2`
- AND el WS anterior se cierra y se abre uno nuevo a `/ws/offices/2`
- AND `localStorage["vo_last_office"] === "2"`

#### Scenario: Selector con una sola oficina
- GIVEN un usuario con acceso a una única oficina
- WHEN abre el HUD
- THEN el selector muestra el nombre de la oficina pero el menú no abre opciones (no hay alternativa)

### Requirement: Oficina por defecto del usuario
El sistema MUST permitir a cada usuario fijar una oficina por defecto via `PATCH /api/me { default_office_id }`. En el siguiente login, el usuario MUST ser dirigido a esa oficina si existe; si no, el sistema MUST aplicar la prioridad: `localStorage["vo_last_office"]` → primera oficina con `is_admin=true` → primera oficina visible → pantalla "sin oficina".

#### Scenario: Login con default_office_id
- GIVEN un usuario con `users.default_office_id=2` en DB
- WHEN hace login
- THEN se le redirige a `OfficeScene` con `officeId=2`

#### Scenario: Login sin default y sin localStorage
- GIVEN un usuario sin `default_office_id` y sin `localStorage["vo_last_office"]`
- AND con acceso a 2 oficinas
- WHEN hace login
- THEN se le redirige a la primera oficina visible (orden: id ascendente)

#### Scenario: Login sin oficinas
- GIVEN un usuario que aún no tiene acceso a ninguna oficina
- WHEN hace login
- THEN ve la pantalla "Aún no hay oficinas. Pide a un admin que cree una"

### Requirement: Permisos por oficina (office_admins)
El sistema MUST permitir asignar admins a oficinas concretas mediante la tabla `office_admins`. Las acciones de admin sobre una oficina (subir mapa, crear/borrar desks, asignar fijos, gestionar invitaciones) MUST permitirse a:
- Super-admin (`users.is_admin=1`).
- Office-admin (`office_admins` con `user_id=:me` y `office_id=:target`).

Solo el super-admin MUST poder crear o borrar entradas en `office_admins`.

#### Scenario: Office-admin sube mapa a su oficina
- GIVEN Alice con `office_admins(office_id=1, user_id=Alice)` y `users.is_admin=0`
- WHEN hace `POST /api/offices/1` con un nuevo bundle Tiled
- THEN la respuesta es 200 y el mapa se actualiza

#### Scenario: Office-admin no puede subir a otra oficina
- GIVEN Alice con `office_admins(office_id=1, user_id=Alice)`
- WHEN hace `POST /api/offices/2`
- THEN la respuesta es 403 con `reason="not_authorized"`

#### Scenario: Office-admin no puede otorgar admin
- GIVEN Alice como office-admin de oficina 1 (no super-admin)
- WHEN hace `POST /api/offices/1/admins { user_id: Bob.id }`
- THEN la respuesta es 403

#### Scenario: Super-admin otorga office-admin
- GIVEN Carla con `users.is_admin=1`
- WHEN hace `POST /api/offices/1/admins { user_id: Bob.id }`
- THEN la respuesta es 201
- AND existe una fila en `office_admins(office_id=1, user_id=Bob.id, granted_by=Carla.id)`

### Requirement: Lista de oficinas con flags por usuario
El sistema MUST devolver en `GET /api/offices` por cada oficina los flags `is_admin` (true si super-admin o office-admin) y `is_default` (true si coincide con `users.default_office_id` del usuario autenticado).

#### Scenario: Usuario office-admin
- GIVEN Alice con `office_admins(office_id=1)` y `default_office_id=null`
- WHEN hace `GET /api/offices`
- THEN la respuesta incluye `[{ id: 1, name: ..., is_admin: true, is_default: false }, { id: 2, ..., is_admin: false, is_default: false }]`

### Requirement: Endpoint /readyz para readiness check
El sistema MUST exponer `GET /readyz` público que verifica que la base de datos responde Y que todas las migraciones esperadas están aplicadas en `_migrations`. La respuesta MUST ser 200 con `{ status: "ready" }` cuando todo está bien, o 503 con `{ status: "degraded", reason }` en caso contrario.

#### Scenario: Sistema listo

- GIVEN el servidor arrancado con DB accesible y todas las migraciones aplicadas
- WHEN un cliente solicita `GET /readyz`
- THEN la respuesta es 200 con `{ status: "ready" }`

#### Scenario: DB caída

- GIVEN el servidor arrancado pero la DB no responde
- WHEN se solicita `GET /readyz`
- THEN la respuesta es 503 con `{ status: "degraded", reason: "db_down" }`

#### Scenario: Migración faltante

- GIVEN el servidor arrancado con DB accesible pero falta una migración en `_migrations`
- WHEN se solicita `GET /readyz`
- THEN la respuesta es 503 con `{ status: "degraded", reason: "migrations_pending", missing: ["0007_..."] }`

### Requirement: Endpoint /metrics para Prometheus

El sistema MUST exponer `GET /metrics` en formato Prometheus text con las métricas operacionales clave. El endpoint MUST estar protegido por Basic Auth contra `BASIC_AUTH_METRICS_USER/PASS`. Si esas variables de entorno NO están configuradas, el endpoint MUST devolver 503 (NUNCA datos abiertos).

#### Scenario: Acceso autorizado

- GIVEN el servidor con `BASIC_AUTH_METRICS_USER=metrics` y `BASIC_AUTH_METRICS_PASS=secret`
- WHEN un cliente hace `GET /metrics` con `Authorization: Basic bWV0cmljczpzZWNyZXQ=`
- THEN la respuesta es 200 con `Content-Type: text/plain; version=0.0.4`
- AND el body contiene `vo_http_requests_total`, `vo_ws_connections_active`, `vo_uptime_seconds`

#### Scenario: Acceso sin auth

- GIVEN el servidor con env vars de Basic Auth configuradas
- WHEN se hace `GET /metrics` sin header Authorization
- THEN la respuesta es 401 con `WWW-Authenticate: Basic realm="metrics"`

#### Scenario: Sin env vars configuradas

- GIVEN el servidor sin `BASIC_AUTH_METRICS_USER` definido
- WHEN se hace `GET /metrics` con cualquier auth
- THEN la respuesta es 503 (no se exponen datos)

### Requirement: Métricas mínimas exportadas

El sistema MUST exportar al menos las siguientes métricas en `/metrics`:

- `vo_http_requests_total{method,route,status}` (counter)
- `vo_http_request_duration_seconds{method,route}` (histogram)
- `vo_ws_connections_active{office_id}` (gauge)
- `vo_ws_messages_sent_total{type}` (counter)
- `vo_uptime_seconds` (gauge)

#### Scenario: Métrica HTTP tras request

- GIVEN el servidor recién arrancado
- WHEN llega una request `GET /api/me` que devuelve 401
- THEN `vo_http_requests_total{method="GET",route="/api/me",status="401"}` se incrementa en 1

#### Scenario: Gauge de WS al conectar

- GIVEN no hay clientes WS conectados
- WHEN un cliente abre `ws://.../ws/offices/1`
- THEN `vo_ws_connections_active{office_id="1"}` pasa de 0 a 1
- AND vuelve a 0 al cerrar la conexión

### Requirement: Backups automáticos integrados en el servidor

El sistema MUST ejecutar un backup nocturno de la base de datos SQLite directamente desde el proceso Node.js, sin scripts externos ni cron del sistema operativo. El backup MUST usar `VACUUM INTO` para un snapshot consistente, comprimirse con `node:zlib` (gzip) y almacenarse con permisos `600`. El scheduler MUST arrancar automáticamente con el servidor y ser configurable mediante variables de entorno.

#### Scenario: Backup nocturno produce fichero válido

- GIVEN el servidor arrancado con `VO_BACKUP_DIR=/tmp/vo-backups`
- WHEN el scheduler ejecuta `runBackup`
- THEN existe un fichero `/tmp/vo-backups/YYYY-MM-DD-HHmm.db.gz`
- AND el fichero tiene permisos `600`
- AND descomprimirlo con `node:zlib` produce una DB SQLite con los mismos datos

#### Scenario: Retención elimina backups antiguos

- GIVEN existen backups de más de 30 días que no son el último del mes
- WHEN se ejecuta la política de retención
- THEN esos ficheros son eliminados
- AND se conservan los ficheros de los últimos 30 días
- AND se conserva el último fichero de cada mes anterior
