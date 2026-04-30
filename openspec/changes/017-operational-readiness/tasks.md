# Tareas: operational readiness

## 1. Backups

- [ ] 1.1 Crear `backend/scripts/backup-db.sh` con `VACUUM INTO` + gzip + chmod 600.
- [ ] 1.2 Lógica de retención: últimos 30 días + último de cada mes.
- [ ] 1.3 Documentar cron entry en `doc/be/OPERATIONS.md`.
- [ ] 1.4 Documentar procedimiento de restore (parar PM2, descomprimir, sustituir, levantar).
- [ ] 1.5 (test integration manual, no automatizado) Correr backup con DB en uso, verificar que el .gz es restaurable.

## 2. /metrics

- [ ] 2.1 Añadir dependencia `prom-client` al backend.
- [ ] 2.2 Crear `backend/src/http/plugins/metrics.ts` con counters/gauges/histogramas definidos.
- [ ] 2.3 Hook `onResponse` que incrementa `vo_http_requests_total` y `vo_http_request_duration_seconds`.
- [ ] 2.4 Gauge `vo_ws_connections_active` actualizado por el `WsHub`.
- [ ] 2.5 Endpoint `GET /metrics` con Basic Auth contra `BASIC_AUTH_METRICS_USER/PASS`.
- [ ] 2.6 Si las env vars de Basic Auth faltan, el endpoint devuelve 503 (no 200 abierto).
- [ ] 2.7 (test integration) `/metrics` con auth correcto devuelve text plain con métricas.
- [ ] 2.8 (test integration) `/metrics` sin auth o auth inválido devuelve 401.
- [ ] 2.9 (test integration) `/metrics` sin env vars configuradas devuelve 503.

## 3. /readyz

- [ ] 3.1 Crear endpoint `GET /readyz` en `backend/src/http/routes/health.ts`.
- [ ] 3.2 Verifica DB con `SELECT 1`.
- [ ] 3.3 Verifica que `_migrations` contiene todas las versiones esperadas (manifest fijo en código).
- [ ] 3.4 Devuelve 200 `{ status: "ready" }` o 503 con `reason`.
- [ ] 3.5 (test integration) Con todas las migraciones aplicadas → 200 ready.
- [ ] 3.6 (test integration) Con DB cerrada → 503 db_down.
- [ ] 3.7 (test integration) Con migración sintética faltante → 503 migrations_pending.

## 4. PM2 + deploy

- [ ] 4.1 Crear `backend/ecosystem.config.cjs` con la app, env, log files, max_memory_restart.
- [ ] 4.2 Documentar `pm2 install pm2-logrotate` y su configuración.
- [ ] 4.3 Crear `scripts/deploy.sh` con: pull → install → build → reload → readyz check.
- [ ] 4.4 Crear `.env.production.example` con todas las env vars necesarias (sin valores).
- [ ] 4.5 Documentar en `README.md` el flujo de despliegue.

## 5. Sentry release tracking

- [ ] 5.1 Añadir `GIT_SHA` (string opcional) al schema Zod de `env.ts`.
- [ ] 5.2 En `backend/src/infra/observability/sentry.ts`, pasar `release: env.GIT_SHA` al init.
- [ ] 5.3 `setTag("release", GIT_SHA)` global.
- [ ] 5.4 (test unit) Sentry init recibe el release esperado cuando `GIT_SHA` está definido.

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
