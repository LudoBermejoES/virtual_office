# Operaciones — Virtual Office Backend

## Backups automáticos

El servidor ejecuta un backup nocturno de la base de datos SQLite a las 3:00 AM (configurable con `VO_BACKUP_CRON`). Los backups se guardan en `VO_BACKUP_DIR` (por defecto `./backups`) con el nombre `YYYY-MM-DD-HHmm.db.gz` y permisos `600`.

**Política de retención:** se conservan los últimos 30 días y el backup más reciente de cada mes anterior. El resto se elimina automáticamente tras cada backup.

### Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `VO_BACKUP_DIR` | `./backups` | Directorio donde se guardan los backups |
| `VO_BACKUP_CRON` | `0 3 * * *` | Expresión cron del scheduler |

### Restore

1. Parar el servidor:
   ```bash
   pm2 stop virtual-office-api
   # o: kill $(lsof -ti:8080)
   ```

2. Descomprimir el backup elegido con Node.js:
   ```bash
   node -e "
     const { createReadStream, createWriteStream } = require('fs');
     const { createGunzip } = require('zlib');
     const { pipeline } = require('stream/promises');
     pipeline(
       createReadStream('backups/2026-05-01-0300.db.gz'),
       createGunzip(),
       createWriteStream('data/virtual-office.db')
     ).then(() => console.log('Restore OK'));
   "
   ```

3. Arrancar el servidor:
   ```bash
   pm2 start virtual-office-api
   ```

---

## Métricas (`/metrics`)

El endpoint `GET /metrics` expone métricas en formato Prometheus text. Está protegido por Basic Auth.

**Si `BASIC_AUTH_METRICS_USER` no está configurado, el endpoint devuelve 503** — nunca expone datos sin autenticación.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `BASIC_AUTH_METRICS_USER` | Usuario para Basic Auth |
| `BASIC_AUTH_METRICS_PASS` | Contraseña para Basic Auth |

### Métricas exportadas

| Métrica | Tipo | Descripción |
|---|---|---|
| `vo_http_requests_total{method,route,status}` | Counter | Total de requests HTTP |
| `vo_http_request_duration_seconds{method,route}` | Histogram | Duración de requests HTTP |
| `vo_ws_connections_active{office_id}` | Gauge | Conexiones WebSocket activas por oficina |
| `vo_ws_messages_sent_total{type}` | Counter | Total de mensajes WS enviados |
| `vo_uptime_seconds` | Gauge | Tiempo de vida del proceso en segundos |

---

## Readiness check (`/readyz`)

`GET /readyz` verifica que:
1. La base de datos responde (`SELECT 1`).
2. Todas las migraciones esperadas están aplicadas en `_migrations`.

Devuelve `200 { status: "ready" }` si todo está bien, o `503 { status: "degraded", reason, ... }` si no.

---

## Sentry

Configurar `SENTRY_DSN` para activar el reporte de errores. Opcionalmente, `GIT_SHA` etiqueta cada evento con la versión desplegada.

| Variable | Descripción |
|---|---|
| `SENTRY_DSN` | DSN del proyecto en Sentry |
| `GIT_SHA` | Commit SHA inyectado durante el despliegue |

---

## Troubleshooting

**El backup falla:** revisar logs (`backup.failed`) — puede ser disco lleno o permisos insuficientes en `VO_BACKUP_DIR`.

**`/readyz` devuelve `migrations_pending`:** el campo `missing` lista los números de versión pendientes. Ejecutar `pnpm migrate` o reiniciar el servidor (las migraciones se aplican al arrancar).

**`/metrics` devuelve 503:** configurar `BASIC_AUTH_METRICS_USER` y `BASIC_AUTH_METRICS_PASS`.
