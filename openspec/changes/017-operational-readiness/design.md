# Diseño técnico: operational readiness

## A. Backups automáticos (Node.js, integrado en el servidor)

### Scheduler

`node-cron` integrado en `backend/src/server.ts` (o en un módulo `infra/backup/scheduler.ts`
llamado desde el arranque). Configurable con `VO_BACKUP_CRON` (default `"0 3 * * *"`).

```ts
import cron from "node-cron";
import { runBackup } from "./infra/backup/backup.js";

export function startBackupScheduler(db: DatabaseSync, env: Env): void {
  cron.schedule(env.VO_BACKUP_CRON ?? "0 3 * * *", () => {
    runBackup(db, env).catch((err) =>
      logger.error("backup.failed", { error: err }),
    );
  });
}
```

### Lógica de backup (`backend/src/infra/backup/backup.ts`)

Sin bash. Solo `node:sqlite`, `node:fs`, `node:zlib`, `node:path`:

```ts
import { createReadStream, createWriteStream, chmodSync, mkdirSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import type { DatabaseSync } from "node:sqlite";

export async function runBackup(db: DatabaseSync, env: Env): Promise<string> {
  const backupDir = env.VO_BACKUP_DIR ?? "./backups";
  mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const tmpPath = join(backupDir, `${ts}.db.tmp`);
  const gzPath  = join(backupDir, `${ts}.db.gz`);

  // Snapshot consistente vía VACUUM INTO (no bloquea readers, snapshot atómico)
  db.exec(`VACUUM INTO '${tmpPath}'`);

  // Comprimir con node:zlib sin dependencias externas
  await pipeline(createReadStream(tmpPath), createGzip(), createWriteStream(gzPath));
  rmSync(tmpPath);
  chmodSync(gzPath, 0o600);

  await applyRetentionPolicy(backupDir);
  return gzPath;
}
```

### Política de retención (TypeScript puro)

- Mantener todos los ficheros de los **últimos 30 días**.
- Mantener el **último fichero de cada mes** anterior (el más reciente del mes).
- Eliminar el resto con `fs.rmSync`.

Implementada en `backend/src/infra/backup/retention.ts`, testeable sin disco (recibe lista de nombres y fecha de referencia, devuelve cuáles borrar).

### Variables de entorno nuevas

```
VO_BACKUP_DIR=./backups          # directorio de backups
VO_BACKUP_CRON="0 3 * * *"      # expresión cron del scheduler (opcional)
```

### Restore

Documentado en `doc/be/OPERATIONS.md`. Sin comandos bash complejos:

```bash
# 1. Parar el servidor (PM2 o proceso directo)
pm2 stop virtual-office-api

# 2. Descomprimir el backup elegido (node, gunzip, o cualquier herramienta)
node -e "
  const {createReadStream,createWriteStream} = require('fs');
  const {createGunzip} = require('zlib');
  const {pipeline} = require('stream/promises');
  pipeline(createReadStream('backups/2026-05-01-0300.db.gz'), createGunzip(), createWriteStream('data/virtual-office.db'))
    .then(() => console.log('Restore OK'));
"

# 3. Arrancar el servidor
pm2 start virtual-office-api
```

---

## B. /metrics

Plugin Fastify `backend/src/http/plugins/metrics.ts` con `prom-client`:

```ts
import client from "prom-client";
import fp from "fastify-plugin";

export const httpRequestsTotal = new client.Counter({
  name: "vo_http_requests_total",
  labelNames: ["method", "route", "status"],
  help: "Total HTTP requests",
});

export const httpDuration = new client.Histogram({
  name: "vo_http_request_duration_seconds",
  labelNames: ["method", "route"],
  help: "HTTP request duration",
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const wsConnectionsActive = new client.Gauge({
  name: "vo_ws_connections_active",
  labelNames: ["office_id"],
  help: "Active WebSocket connections per office",
});

export const wsMessagesSent = new client.Counter({
  name: "vo_ws_messages_sent_total",
  labelNames: ["type"],
  help: "Total WebSocket messages sent",
});

export const uptimeGauge = new client.Gauge({
  name: "vo_uptime_seconds",
  help: "Server uptime in seconds",
  collect() { this.set(process.uptime()); },
});
```

Hook `onResponse`:

```ts
app.addHook("onResponse", (req, reply, done) => {
  const route = req.routeOptions?.url ?? "unknown";
  httpRequestsTotal.inc({ method: req.method, route, status: String(reply.statusCode) });
  httpDuration.observe({ method: req.method, route }, reply.elapsedTime / 1000);
  done();
});
```

Endpoint:

```ts
app.get("/metrics", async (req, reply) => {
  if (!env.BASIC_AUTH_METRICS_USER || !env.BASIC_AUTH_METRICS_PASS) {
    return reply.code(503).send({ reason: "metrics_not_configured" });
  }
  const auth = req.headers["authorization"] ?? "";
  const expected = "Basic " + Buffer.from(
    `${env.BASIC_AUTH_METRICS_USER}:${env.BASIC_AUTH_METRICS_PASS}`
  ).toString("base64");
  if (auth !== expected) {
    return reply.code(401).header("WWW-Authenticate", 'Basic realm="metrics"').send();
  }
  reply.header("Content-Type", client.register.contentType);
  return client.register.metrics();
});
```

`WsHub` incrementa/decrementa `wsConnectionsActive` al conectar/desconectar, e incrementa
`wsMessagesSent` al hacer broadcast.

---

## C. /readyz

En `backend/src/http/routes/health.ts` (junto al `/healthz` existente):

```ts
app.get("/readyz", async (_req, reply) => {
  // 1. DB ping
  try {
    db.prepare("SELECT 1").get();
  } catch {
    return reply.code(503).send({ status: "degraded", reason: "db_down" });
  }
  // 2. Migraciones up-to-date
  const applied = new Set(
    (db.prepare("SELECT version FROM _migrations").all() as { version: number }[])
      .map((r) => r.version),
  );
  const missing = EXPECTED_MIGRATIONS.filter((v) => !applied.has(v));
  if (missing.length > 0) {
    return reply.code(503).send({ status: "degraded", reason: "migrations_pending", missing });
  }
  return reply.send({ status: "ready" });
});
```

`EXPECTED_MIGRATIONS` es un array constante en código derivado de los ficheros `.sql` en
`src/infra/db/migrations/` — se genera en tiempo de build o se mantiene a mano como manifest
junto a cada nueva migración.

---

## D. Sentry release tracking

En `backend/src/infra/observability/sentry.ts`:

```ts
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    ...(env.GIT_SHA ? { release: env.GIT_SHA } : {}),
  });
  if (env.GIT_SHA) Sentry.setTag("release", env.GIT_SHA);
}
```

`GIT_SHA` añadido como `z.string().optional()` en `env.ts`.

---

## Variables nuevas en `.env.production.example`

```
BASIC_AUTH_METRICS_USER=metrics
BASIC_AUTH_METRICS_PASS=changeme
GIT_SHA=
VO_BACKUP_DIR=./backups
VO_BACKUP_CRON="0 3 * * *"
```

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `/metrics` expuesto sin auth | Devuelve 503 si env vars faltan; test explícito |
| `VACUUM INTO` tarda varios segundos con DB grande | Aceptable a las 3 AM; error capturado y logueado |
| Disco lleno durante backup | `runBackup` propaga el error; scheduler lo loguea; `tmpPath` se limpia en `finally` |
| Retención borra demasiado | Lógica testeada con fechas sintéticas antes de tocar disco |
