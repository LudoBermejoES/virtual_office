# Tareas: operational readiness

El ciclo TDD por tarea: escribe el test (red) → implementa lo mínimo (green) → refactoriza → marca [x].

## 1. Backups automáticos

- [ ] 1.1 (test unit) `applyRetentionPolicy(files, now)` retiene los últimos 30 días y el último de cada mes, y devuelve los nombres a borrar — escribir el test primero.
- [ ] 1.2 Crear `backend/src/infra/backup/retention.ts` con la lógica de retención pura (sin I/O).
- [ ] 1.3 (test integration) `runBackup(db, env)` produce un `.db.gz` con permisos 600 que `node:zlib` puede descomprimir a una DB SQLite válida — escribir el test primero.
- [ ] 1.4 Crear `backend/src/infra/backup/backup.ts` con `runBackup`: `VACUUM INTO` + `node:zlib` gzip + `chmod 600` + llamada a retención.
- [ ] 1.5 Añadir `VO_BACKUP_DIR` y `VO_BACKUP_CRON` (ambos opcionales con defaults) al schema Zod de `env.ts`.
- [ ] 1.6 Crear `backend/src/infra/backup/scheduler.ts` con `startBackupScheduler(db, env)` usando `node-cron`.
- [ ] 1.7 Llamar a `startBackupScheduler` desde `backend/src/server.ts` al arrancar.
- [ ] 1.8 Documentar restore en `doc/be/OPERATIONS.md` (parar servidor, descomprimir con Node.js, arrancar).

## 2. /metrics

- [ ] 2.1 (test integration) `GET /metrics` con Basic Auth correcto devuelve 200 con `Content-Type: text/plain` y contiene `vo_http_requests_total` — escribir el test primero.
- [ ] 2.2 (test integration) `GET /metrics` sin header `Authorization` devuelve 401 con `WWW-Authenticate` — escribir el test primero.
- [ ] 2.3 (test integration) `GET /metrics` con credenciales incorrectas devuelve 401 — escribir el test primero.
- [ ] 2.4 (test integration) `GET /metrics` sin `BASIC_AUTH_METRICS_USER` configurado devuelve 503 — escribir el test primero.
- [ ] 2.5 (test integration) Tras `GET /api/me` (401), `vo_http_requests_total{method="GET",route="/api/me",status="401"}` se incrementa en 1 — escribir el test primero.
- [ ] 2.6 (test integration) Al abrir y cerrar un WS, `vo_ws_connections_active{office_id}` sube a 1 y vuelve a 0 — escribir el test primero.
- [ ] 2.7 Añadir `prom-client` como dependencia del backend.
- [ ] 2.8 Crear `backend/src/http/plugins/metrics.ts`: definir counters, histogramas y gauges; hook `onResponse`; endpoint `GET /metrics` con Basic Auth.
- [ ] 2.9 Añadir `BASIC_AUTH_METRICS_USER` y `BASIC_AUTH_METRICS_PASS` (opcionales) al schema Zod de `env.ts`.
- [ ] 2.10 Actualizar `WsHub` para incrementar `wsConnectionsActive` al conectar/desconectar y `wsMessagesSent` al hacer broadcast.
- [ ] 2.11 Registrar el plugin `metrics` en `backend/src/http/server.ts`.

## 3. /readyz

- [ ] 3.1 (test integration) Con todas las migraciones aplicadas → 200 `{ status: "ready" }` — escribir el test primero.
- [ ] 3.2 (test integration) Con migración sintética faltante → 503 `{ status: "degraded", reason: "migrations_pending", missing: [...] }` — escribir el test primero.
- [ ] 3.3 Añadir endpoint `GET /readyz` en `backend/src/http/routes/health.ts`.
- [ ] 3.4 Implementar comprobación `SELECT 1` para DB ping.
- [ ] 3.5 Implementar manifest `EXPECTED_MIGRATIONS` (array de versiones enteras derivado de los ficheros `.sql`) y comparación con `_migrations`.

## 4. Sentry release tracking

- [ ] 4.1 (test unit) `initSentry(env)` pasa `release: env.GIT_SHA` a `Sentry.init` cuando la variable está definida — escribir el test primero.
- [ ] 4.2 (test unit) `initSentry(env)` no pasa `release` cuando `GIT_SHA` no está definido — escribir el test primero.
- [ ] 4.3 Añadir `GIT_SHA` (string opcional) al schema Zod de `env.ts`.
- [ ] 4.4 Actualizar `backend/src/infra/observability/sentry.ts` para pasar `release` y `setTag` cuando `GIT_SHA` está definido.

## 5. Documentación y configuración

- [ ] 5.1 Crear `doc/be/OPERATIONS.md`: backups, restore con Node.js, métricas, readyz, troubleshooting.
- [ ] 5.2 Crear `.env.production.example` con todas las variables nuevas sin valores reales.
- [ ] 5.3 Actualizar `README.md` con mención a `OPERATIONS.md` y las nuevas variables.

## 6. Verificación

- [ ] 6.1 `pnpm test` (unit + integration) en verde.
- [ ] 6.2 `pnpm e2e:chromium` en verde.
- [ ] 6.3 `openspec validate --all --strict` en verde.
