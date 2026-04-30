# Propuesta: Operational readiness (despliegue, backups, métricas)

## Motivación

El sistema funciona en local, pero **no está listo para producción real**. Faltan piezas críticas de operación:
- No hay backups automáticos de la SQLite.
- No hay endpoint `/metrics` ni dashboard mínimo.
- El despliegue con PM2 está documentado a alto nivel pero no hay `ecosystem.config.cjs`, ni script de release, ni rotación verificada de logs.
- No hay healthcheck distinto a `/healthz` (que es público): falta `/readyz` que verifique conexión a la DB y que las migraciones están al día.
- No hay procedimiento de restore documentado.

Sin estas piezas, cualquier incidente en producción cuesta horas: o se pierden datos, o el sistema queda caído sin diagnóstico, o el deploy es manual y propenso a errores.

## Alcance

**En scope:**

### A. Backups automáticos
- Script `backend/scripts/backup-db.sh` que hace `cp data/virtual-office.db backups/YYYY-MM-DD-HHmm.db.gz` (con `gzip`) y rota dejando los últimos 30 días + el último de cada mes.
- Cron line documentada para `0 3 * * *` (3 AM).
- Procedimiento de restore documentado: parar servicio, descomprimir, sustituir, levantar.

### B. Métricas
- Endpoint `GET /metrics` (formato Prometheus text) protegido por `BASIC_AUTH_METRICS_USER/PASS` o IP allowlist (configurable).
- Métricas:
  - `vo_http_requests_total{method,route,status}` (counter).
  - `vo_http_request_duration_seconds{method,route}` (histogram).
  - `vo_ws_connections_active{office_id}` (gauge).
  - `vo_ws_messages_sent_total{type}` (counter).
  - `vo_db_query_duration_seconds{op}` (histogram).
  - `vo_bookings_total` (gauge, recomputado cada 60 s).
  - `vo_uptime_seconds` (gauge).

### C. /readyz separado de /healthz
- `/healthz` (público, lo que ya existe) — solo "el proceso está vivo".
- `/readyz` (público, nuevo) — DB accesible **y** todas las migraciones registradas en `_migrations` coinciden con las del código. Devuelve 503 si no.

### D. Deploy con PM2
- `ecosystem.config.cjs` con apps: `virtual-office-api`, opciones de log rotación con `pm2-logrotate`.
- Script `scripts/deploy.sh`: pull, install, build, migrate, reload PM2 sin downtime (`pm2 reload`).
- Variables `.env.production.example` (sin valores reales) documentando todas las necesarias.

### E. Rotación de logs verificada
- Los logs Winston ya rotan diario. Test manual: dejar correr una semana, verificar que `logs/` no crece sin parar.
- Cota dura: tamaño total `logs/` > 500 MB → eliminar los más antiguos.

### F. Sentry release tracking
- En el arranque, configurar `Sentry.setTag("release", env.GIT_SHA)`. El script de deploy inyecta `GIT_SHA=$(git rev-parse HEAD)`.

**Fuera de scope:**
- Kubernetes / Docker (PM2 sigue siendo el deploy target).
- Multi-región.
- Auto-scaling.

## Dominios afectados

`oficinas` (extensión: endpoints `/metrics`, `/readyz`).

## Orden y dependencias

Change `017`. Depende solo de `001-project-foundation`.

## Impacto de seguridad

- `/metrics` MUST estar protegido. Si no hay `BASIC_AUTH_METRICS_USER` configurado, el endpoint devuelve 503 (no 200 con datos abiertos).
- `/readyz` es público pero solo expone "ok"/"degraded" — no detalles internos.
- `backup-db.sh` debe correr como user no-root y los `.gz` deben tener `chmod 600`.

## Rollback

- Borrar `/metrics` y `/readyz` no afecta a usuarios.
- Si los backups consumen espacio, ajustar política de retención.
