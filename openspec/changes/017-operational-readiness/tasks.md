# Tareas: operational readiness

El ciclo TDD por tarea: escribe el test (red) → implementa lo mínimo (green) → refactoriza → marca [x].

## 1. Backups

- [ ] 1.1 (test integration) `backup-db.sh` con DB en uso produce un fichero `.db.gz` con permisos 600 que se puede restaurar — escribir el test de shell primero (usar bats o bash con assert).
- [ ] 1.2 Crear `backend/scripts/backup-db.sh` con `VACUUM INTO` + gzip + chmod 600.
- [ ] 1.3 Lógica de retención: últimos 30 días + último de cada mes.
- [ ] 1.4 Documentar cron entry en `doc/be/OPERATIONS.md`.
- [ ] 1.5 Documentar procedimiento de restore (parar PM2, descomprimir, sustituir, levantar).

## 2. /metrics

- [ ] 2.1 (test integration) `GET /metrics` con auth correcto devuelve `Content-Type: text/plain` con las métricas mínimas — escribir el test primero.
- [ ] 2.2 (test integration) `GET /metrics` sin header `Authorization` devuelve 401 con `WWW-Authenticate` — escribir el test primero.
- [ ] 2.3 (test integration) `GET /metrics` con credenciales incorrectas devuelve 401 — escribir el test primero.
- [ ] 2.4 (test integration) `GET /metrics` sin `BASIC_AUTH_METRICS_USER` configurado devuelve 503 — escribir el test primero.
- [ ] 2.5 (test integration) Tras `GET /api/me` (que devuelve 401), `vo_http_requests_total{method="GET",route="/api/me",status="401"}` se incrementa en 1 — escribir el test primero.
- [ ] 2.6 (test integration) Al abrir y cerrar un WS, `vo_ws_connections_active{office_id}` sube a 1 y vuelve a 0 — escribir el test primero.
- [ ] 2.7 Añadir dependencia `prom-client` al backend.
- [ ] 2.8 Crear `backend/src/http/plugins/metrics.ts` con counters/gauges/histogramas definidos.
- [ ] 2.9 Hook `onResponse` que incrementa `vo_http_requests_total` y `vo_http_request_duration_seconds`.
- [ ] 2.10 Gauge `vo_ws_connections_active` actualizado por el `WsHub`.
- [ ] 2.11 Endpoint `GET /metrics` con Basic Auth contra `BASIC_AUTH_METRICS_USER/PASS`.
- [ ] 2.12 Si las env vars de Basic Auth faltan, el endpoint devuelve 503 (no 200 abierto).

## 3. /readyz

- [ ] 3.1 (test integration) Con todas las migraciones aplicadas → 200 `{ status: "ready" }` — escribir el test primero.
- [ ] 3.2 (test integration) Con DB cerrada → 503 `{ status: "degraded", reason: "db_down" }` — escribir el test primero.
- [ ] 3.3 (test integration) Con migración sintética faltante → 503 `{ status: "degraded", reason: "migrations_pending", missing: [...] }` — escribir el test primero.
- [ ] 3.4 Crear endpoint `GET /readyz` en `backend/src/http/routes/health.ts`.
- [ ] 3.5 Verifica DB con `SELECT 1`.
- [ ] 3.6 Verifica que `_migrations` contiene todas las versiones esperadas (manifest fijo en código).
- [ ] 3.7 Devuelve 200 `{ status: "ready" }` o 503 con `reason`.

## 4. PM2 + deploy

- [ ] 4.1 Crear `backend/ecosystem.config.cjs` con la app, env, log files, max_memory_restart.
- [ ] 4.2 Documentar `pm2 install pm2-logrotate` y su configuración.
- [ ] 4.3 Crear `scripts/deploy.sh` con: pull → install → build → reload → readyz check.
- [ ] 4.4 Crear `.env.production.example` con todas las env vars necesarias (sin valores).
- [ ] 4.5 Documentar en `README.md` el flujo de despliegue.

## 5. Sentry release tracking

- [ ] 5.1 (test unit) Sentry init recibe `release: env.GIT_SHA` cuando la variable está definida — escribir el test primero.
- [ ] 5.2 (test unit) Sentry init no pasa `release` cuando `GIT_SHA` no está definido — escribir el test primero.
- [ ] 5.3 Añadir `GIT_SHA` (string opcional) al schema Zod de `env.ts`.
- [ ] 5.4 En `backend/src/infra/observability/sentry.ts`, pasar `release: env.GIT_SHA` al init.
- [ ] 5.5 `setTag("release", GIT_SHA)` global.

## 6. Documentación

- [ ] 6.1 Crear `doc/be/OPERATIONS.md` con: backups, restore, deploy, métricas, readyz, troubleshooting.
- [ ] 6.2 Sección "primer deploy" paso a paso.
- [ ] 6.3 Sección "qué hacer si /readyz devuelve degraded".
- [ ] 6.4 Documentar las métricas más importantes para alertas (tasa de 5xx, conexiones WS, latencia p95).

## 7. Verificación

- [ ] 7.1 `pnpm test` en verde.
- [ ] 7.2 Probar deploy script en una VM de test.
- [ ] 7.3 Probar `backup-db.sh` y `restore` end-to-end en local.
- [ ] 7.4 `openspec validate --all --strict` en verde.
