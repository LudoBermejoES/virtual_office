# Propuesta: Operational readiness (backups, métricas, readyz)

## Motivación

El sistema funciona en local, pero **no está listo para producción real**. Faltan piezas críticas de operación:
- No hay backups automáticos de la SQLite.
- No hay endpoint `/metrics` ni dashboard mínimo.
- No hay `/readyz` que verifique la DB y el estado de las migraciones.
- No hay procedimiento de restore documentado.

Sin estas piezas, cualquier incidente en producción cuesta horas: o se pierden datos, o el sistema queda caído sin diagnóstico.

## Alcance

**En scope:**

### A. Backups automáticos integrados en el servidor

- Scheduler Node.js (`node-cron`) **integrado en el proceso del servidor** que ejecuta el backup cada noche a las 3 AM.
- El backup usa `VACUUM INTO` de SQLite para un snapshot consistente, luego comprime con `node:zlib` (gzip) — **sin bash ni comandos externos**.
- Política de retención: últimos 30 días + el último de cada mes — implementada en TypeScript.
- Directorio configurable con `VO_BACKUP_DIR` (default `./backups`).
- Permisos del fichero resultante: `chmod 600` vía `fs.chmod`.
- Restore documentado en `doc/be/OPERATIONS.md`.

### B. Métricas

- Endpoint `GET /metrics` (formato Prometheus text) protegido por Basic Auth con `BASIC_AUTH_METRICS_USER/PASS`.
- Si las env vars no están configuradas, devuelve 503 — **nunca datos abiertos**.
- Métricas:
  - `vo_http_requests_total{method,route,status}` (counter)
  - `vo_http_request_duration_seconds{method,route}` (histogram)
  - `vo_ws_connections_active{office_id}` (gauge)
  - `vo_ws_messages_sent_total{type}` (counter)
  - `vo_uptime_seconds` (gauge)

### C. /readyz separado de /healthz

- `/healthz` (público, existente) — solo "el proceso está vivo".
- `/readyz` (público, nuevo) — DB accesible **y** todas las migraciones registradas. Devuelve 503 si no.

### D. Sentry release tracking

- En el arranque, `Sentry.init({ release: env.GIT_SHA })` + `Sentry.setTag("release", GIT_SHA)`.
- `GIT_SHA` es una env var opcional inyectada durante el despliegue.

**Fuera de scope:**
- Deploy scripts (se abordarán en un change posterior).
- Kubernetes / Docker.
- Scripts bash / cron del sistema operativo.

## Dominios afectados

`oficinas` (extensión: endpoints `/metrics`, `/readyz`).

## Orden y dependencias

Change `017`. Depende solo de `001-project-foundation`.

## Impacto de seguridad

- `/metrics` MUST estar protegido. Si no hay `BASIC_AUTH_METRICS_USER` configurado → 503, nunca 200 con datos.
- `/readyz` es público pero solo expone "ok"/"degraded" — sin detalles internos sensibles.
- Los ficheros `.db.gz` de backup tienen `chmod 600` vía Node.js.

## Rollback

- Borrar `/metrics` y `/readyz` no afecta a usuarios.
- Desactivar el scheduler de backups es un cambio de una línea en la config.
