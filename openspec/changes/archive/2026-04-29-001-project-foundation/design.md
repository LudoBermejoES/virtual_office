# Diseño técnico: Project Foundation

## Layout del monorepo

```
teimas_space/
├── package.json                   ← workspaces: backend, frontend, packages/*
├── pnpm-workspace.yaml             (preferimos pnpm por velocidad y workspaces estrictos)
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── ecosystem.config.cjs
│   └── src/
│       ├── server.ts
│       ├── config/{env.ts, logger.ts}
│       ├── infra/db/{sqlite.ts, migrations.ts, migrations/0001_init.sql}
│       ├── infra/observability/sentry.ts
│       └── http/routes/health.ts
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/{main.ts, index.html, style.css, scenes/BootScene.ts}
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/types.ts
└── data/                            (gitignored — DB y mapas en runtime)
```

## Decisiones técnicas

### Node.js 24 LTS

LTS más reciente con `node:sqlite` ya en línea estable (introducido en 22.5, refinado en 24). Activamos el módulo SQLite con la flag `--experimental-sqlite` solo si la versión instalada lo requiere; comprobamos al boot:

```ts
import { DatabaseSync } from "node:sqlite";  // import puro, falla rápido si no está
```

### TypeScript estricto

`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Compilación con `tsc` para producción; `tsx` para dev/watch.

### Fastify (no Express)

- Schema validation con Zod via `@fastify/type-provider-zod`.
- Plugins: `@fastify/cookie`, `@fastify/cors`, `@fastify/multipart`, `@fastify/websocket`, `@fastify/rate-limit`.
- Logger nativo deshabilitado: usamos Winston para uniformidad con prod.

### node:sqlite

- WAL mode, `foreign_keys=ON`, `synchronous=NORMAL`.
- Wrapper en `infra/db/sqlite.ts` que expone `prepare`, `transaction`, `close`.
- Migraciones en `infra/db/migrations/NNNN_descripcion.sql`, ejecutadas en orden por la versión, registradas en `_migrations`.

### Winston

- Transport `Console` siempre.
- Transport `DailyRotateFile` solo en producción.
- Formato JSON con timestamp y `service: teimas-space`.
- `requestId` propagado vía `AsyncLocalStorage`.

### Sentry

- `@sentry/node` solo se inicializa si `SENTRY_DSN`.
- Integración con Winston enviando logs `>= error` a Sentry como breadcrumbs.
- `tracesSampleRate: 0.1` en prod, `1.0` en staging.

### PM2

- `cluster` mode con `instances: "max"`.
- `max_memory_restart: 512M`.
- Logs PM2 separados de los logs de aplicación (PM2 captura stdout/stderr; Winston escribe en `logs/app-*.log`).

### Phaser 4 + Vite

- Plantilla oficial Phaser 4 + Vite 6 (`pnpm create phaser@latest`).
- `pixelArt: true`, `roundPixels: true`, `Phaser.Scale.NEAREST`.
- `BootScene` carga fuentes pixel via FontFace API antes de iniciar otras escenas.

### Tipos compartidos

`packages/shared` exporta los tipos de payload HTTP/WS. Backend y frontend lo consumen como dependencia local. Evita drift entre los dos extremos.

## Migraciones SQL iniciales

`backend/src/infra/db/migrations/0001_init.sql` crea todas las tablas (ver `doc/be/README.md` sección "Schema base"). Idempotente con `CREATE TABLE IF NOT EXISTS`. La tabla `_migrations` registra cada versión aplicada.

Las tablas iniciales son: `users`, `offices` (con campos del Tiled: `tmj_filename`, `tile_width`, `tile_height`, `cells_x`, `cells_y`, `map_width`, `map_height`), `office_tilesets` (1:N con `offices`), `desks` (con `x`, `y`), `bookings`, `invitations` y `_migrations`.

## Variables de entorno

```
NODE_ENV=development|production|test
PORT=8080
LOG_LEVEL=debug|info|warn|error

DB_PATH=./data/teimas-space.db

SESSION_SECRET=<256 bits hex>
SESSION_TTL_DAYS=7

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TEIMAS_DOMAINS=teimas.com,teimas.es
ADMIN_EMAILS=

SENTRY_DSN=

OFFICE_MAPS_DIR=./data/maps
MAX_MAP_BYTES=5242880
```

Validadas con Zod. Si falta cualquier obligatoria del entorno actual, el proceso muere con código 1 antes de aceptar tráfico.

## Endpoint `/healthz`

```http
GET /healthz
200 { "status": "ok", "db": "ok", "sentry": "off" }
```

- `db: "ok"` ejecuta `SELECT 1` y mide latencia.
- `sentry: "on" | "off"` según init.
- Sin auth.
- Sin logs de cada hit (ruido).

## Frontend bootstrap

`main.ts`:

```
1. precarga FontFace (Press Start 2P, VT323) → await ready
2. crea Phaser.Game con BootScene
3. monta div #ui para overlays HTML futuros
```

`BootScene` solo arranca, hace fetch a `/healthz` y muestra "PRESS START — LOADING…". En este change no navega a ninguna otra escena (no existen aún).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `node:sqlite` cambia de API en versiones futuras | Wrapper aislado; cambios localizados |
| Phaser 4 cambia API entre RC y stable | Pin estricto de versión; CHANGELOG review en upgrades |
| PM2 cluster + SQLite escritor único | Documentado; bajar a 1 instancia si hace falta |
| FOUT de fuentes pixel | `font-display: block` + await FontFace antes de Phaser |

## Diagrama de boot

```
process start
  ├─► loadEnv()  (zod validate)
  ├─► initSentry()  (no-op si DSN vacío)
  ├─► createLogger()  (Winston)
  ├─► openDb()  (WAL, FK ON)
  ├─► runMigrations()  (idempotente)
  ├─► buildServer()  (Fastify + plugins)
  │      └─► register /healthz
  └─► server.listen(PORT)
       │
       └─► logger.info("server up", { port })
```
