# Diseño técnico: operational readiness

## Backups

`backend/scripts/backup-db.sh` (bash, sin dependencias):

```bash
#!/usr/bin/env bash
set -euo pipefail
DB="${VO_DB_PATH:-./data/virtual-office.db}"
DEST="${VO_BACKUP_DIR:-./backups}"
mkdir -p "$DEST"
TS=$(date -u +"%Y-%m-%d-%H%M")
TARGET="$DEST/$TS.db.gz"

# SQLite en modo WAL: usar VACUUM INTO para snapshot consistente
sqlite3 "$DB" "VACUUM INTO '$DEST/$TS.db.tmp'"
gzip -9 "$DEST/$TS.db.tmp"
mv "$DEST/$TS.db.tmp.gz" "$TARGET"
chmod 600 "$TARGET"

# Rotación: últimos 30 días + último de cada mes
find "$DEST" -name "*.db.gz" -mtime +30 -print0 | \
  xargs -0 -I{} bash -c '... lógica de retención ...'
```

Cron entry documentada (no instalada por el script):

```
0 3 * * * /opt/virtual-office/backend/scripts/backup-db.sh >> /var/log/vo-backup.log 2>&1
```

### Restore

Documentado en `doc/be/OPERATIONS.md`:

```bash
pm2 stop virtual-office-api
gunzip -c backups/2026-05-01-0300.db.gz > data/virtual-office.db
pm2 start virtual-office-api
```

## /metrics

Plugin Fastify `backend/src/http/plugins/metrics.ts` usando `prom-client`:

```ts
import client from "prom-client";

export const httpRequestsTotal = new client.Counter({
  name: "vo_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
});
// ... resto

app.addHook("onResponse", async (req, reply) => {
  httpRequestsTotal.inc({
    method: req.method,
    route: req.routeOptions.url ?? "unknown",
    status: reply.statusCode,
  });
});

app.get("/metrics", async (req, reply) => {
  if (!await checkBasicAuth(req)) {
    reply.code(401).header("WWW-Authenticate", 'Basic realm="metrics"').send();
    return;
  }
  reply.header("Content-Type", client.register.contentType);
  return client.register.metrics();
});
```

`checkBasicAuth(req)` lee `Authorization: Basic <base64(user:pass)>` y compara con `env.BASIC_AUTH_METRICS_USER` / `PASS`. Si las env vars no están seteadas, devuelve 503 inmediato.

## /readyz

```ts
app.get("/readyz", async (req, reply) => {
  // 1. DB ping
  try {
    db.prepare("SELECT 1").get();
  } catch {
    return reply.code(503).send({ status: "degraded", reason: "db_down" });
  }
  // 2. Migraciones up-to-date
  const applied = db.prepare("SELECT version FROM _migrations").all().map(r => r.version);
  const expected = listExpectedMigrations(); // de un manifest
  const missing = expected.filter(v => !applied.includes(v));
  if (missing.length > 0) {
    return reply.code(503).send({ status: "degraded", reason: "migrations_pending", missing });
  }
  return { status: "ready" };
});
```

## PM2

`backend/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [{
    name: "virtual-office-api",
    script: "./dist/main.js",
    cwd: "/opt/virtual-office/backend",
    instances: 1,
    exec_mode: "fork",
    env: { NODE_ENV: "production" },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    merge_logs: true,
    max_memory_restart: "512M",
    kill_timeout: 5000,
  }],
};
```

`pm2-logrotate` instalado y configurado:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Deploy script

`scripts/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/virtual-office
git fetch origin main
git reset --hard origin/main
pnpm install --frozen-lockfile
pnpm --filter backend build
GIT_SHA=$(git rev-parse HEAD)
export GIT_SHA
pm2 reload virtual-office-api --update-env
sleep 2
curl -fs http://localhost:18081/readyz || (echo "Readiness check failed" && exit 1)
echo "Deploy OK: $GIT_SHA"
```

## Sentry release

```ts
if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, release: env.GIT_SHA });
  Sentry.setTag("release", env.GIT_SHA);
}
```

## Variables nuevas

`.env.production.example` añade:

```
BASIC_AUTH_METRICS_USER=metrics
BASIC_AUTH_METRICS_PASS=changeme
GIT_SHA=
VO_BACKUP_DIR=/opt/virtual-office/backups
```

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `/metrics` expuesto sin auth | Devolver 503 si las env vars faltan + test que lo verifica |
| Backups sin disk space → falla silenciosa | Cron logs a fichero + alerta si tamaño no crece |
| `pm2 reload` con DB en mitad de una migración | El script aplica migraciones antes del reload, no después |
| `VACUUM INTO` bloquea writes durante varios segundos | Aceptable a las 3 AM; documentar en OPERATIONS.md |
