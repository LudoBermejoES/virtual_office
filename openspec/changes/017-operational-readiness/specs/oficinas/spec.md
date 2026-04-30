# Delta — Oficinas

## ADDED Requirements

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
- GIVEN el servidor arrancado con DB accesible pero falta una migración
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

### Requirement: Backups automáticos versionados
El sistema MUST proveer el script `backend/scripts/backup-db.sh` que produce un snapshot consistente (`VACUUM INTO`) comprimido (`gzip`) en el directorio configurable `VO_BACKUP_DIR`. El script MUST aplicar `chmod 600` al fichero resultante. El sistema MUST documentar la política de retención (30 días + último de cada mes) y la cron entry recomendada.

#### Scenario: Backup correcto
- GIVEN una DB con datos y el directorio `VO_BACKUP_DIR=/tmp/vo-backups` existente
- WHEN se ejecuta `backup-db.sh`
- THEN existe un fichero `/tmp/vo-backups/YYYY-MM-DD-HHmm.db.gz`
- AND el fichero tiene permisos `600`
- AND `gunzip -c` del fichero produce una DB SQLite válida con los mismos datos

#### Scenario: Restore documentado
- GIVEN un backup `2026-05-01-0300.db.gz`
- WHEN un operador sigue el procedimiento documentado en `doc/be/OPERATIONS.md`
- THEN la DB se restaura completamente
- AND el sistema reanuda operación con los datos de ese momento
