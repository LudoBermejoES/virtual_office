# Arquitectura Backend — Teimas Space

> Node.js LTS más reciente, SQLite nativo (`node:sqlite`), Fastify, WebSockets `ws`, Winston + Sentry, gestionado por PM2.

## Resumen ejecutivo

| Decisión | Elección | Por qué |
|----------|----------|---------|
| Runtime | **Node.js 24 LTS** | LTS reciente con `node:sqlite` (introducido en 22.5, estabilizado en la línea 24). Sin dependencias C++ que recompilar |
| Lenguaje | **TypeScript** | Tipado fuerte en dominio + IDE integrations sin coste de runtime gracias a `tsx` y `node --strip-types` |
| HTTP framework | **Fastify** | 2-3× más rápido que Express, plugins de schema validation, ergonómico con TS, soporte de WS de primera clase con `@fastify/websocket` |
| Mapa de oficina | **Tiled JSON (.tmj) + tilesets PNG** | El admin diseña el mapa en [Tiled](https://www.mapeditor.org/) y exporta `.tmj` (uncompressed); Phaser lo consume con `load.tilemapTiledJSON` |
| DB | **SQLite vía `node:sqlite`** | Cumple el requisito del usuario, cero dependencias, archivo único, suficiente para una oficina virtual |
| Realtime | **WebSocket (`ws` + `@fastify/websocket`)** | Mejor para "ocupación en tiempo real" que polling REST |
| Auth | **Google OAuth 2.0** vía `google-auth-library` | Validación server-side del `hd` claim del ID token |
| Logging | **Winston** + `winston-daily-rotate-file` | Log estructurado JSON, rotación, integración nativa con Sentry |
| Errors / alerts | **Sentry** vía `@sentry/node` | Integración nativa con Winston desde 2025 |
| Process manager | **PM2** | Cluster mode, auto-restart, ecosystem file versionable |
| Testing | Ver `doc/tests/README.md` | TDD con Vitest + Supertest |

---

## Estructura de carpetas

```
backend/
├── src/
│   ├── server.ts                ← bootstrap Fastify, registra plugins, arranca WS
│   ├── config/
│   │   ├── env.ts               ← Zod schema de variables de entorno
│   │   └── logger.ts            ← Winston factory
│   ├── domain/                  ← lógica de negocio pura, sin IO
│   │   ├── booking.ts
│   │   ├── desk.ts
│   │   ├── user.ts
│   │   ├── invitation.ts
│   │   └── geometry.ts          ← validación de puntos, distancia entre desks
│   ├── infra/
│   │   ├── db/
│   │   │   ├── sqlite.ts        ← wrapper de node:sqlite
│   │   │   ├── migrations.ts    ← migraciones SQL versionadas
│   │   │   └── migrations/
│   │   │       ├── 0001_init.sql
│   │   │       └── 0002_…
│   │   ├── repos/
│   │   │   ├── users.ts
│   │   │   ├── offices.ts
│   │   │   ├── desks.ts
│   │   │   ├── bookings.ts
│   │   │   └── invitations.ts
│   │   ├── auth/
│   │   │   ├── google-verifier.ts   ← envoltura de google-auth-library
│   │   │   └── session.ts           ← cookie de sesión firmada
│   │   ├── storage/
│   │   │   └── office-maps.ts       ← carga de PNG/JPG/WebP/SVG en disco
│   │   ├── ws/
│   │   │   ├── hub.ts                ← rooms por officeId
│   │   │   └── messages.ts           ← tipos de mensaje
│   │   └── observability/
│   │       └── sentry.ts
│   ├── http/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── invitations.ts
│   │   │   ├── offices.ts
│   │   │   ├── desks.ts
│   │   │   └── bookings.ts
│   │   ├── plugins/
│   │   │   ├── auth-guard.ts        ← decorator requireAuth, requireAdmin
│   │   │   └── error-handler.ts
│   │   └── ws/
│   │       └── occupancy.ts          ← /ws/offices/:id
│   └── services/                  ← orquestación entre dominio + infra
│       ├── booking-service.ts
│       ├── invitation-service.ts
│       └── office-service.ts
├── ecosystem.config.cjs           ← PM2
├── package.json
├── tsconfig.json
└── tests/                          ← ver doc/tests/README.md
```

### Capas y dependencias

```
http  ─►  services  ─►  domain
                ▲
                └────►  infra (db, auth, ws, storage)
```

- `domain/` no importa de `infra/` ni de `http/`. Son funciones puras.
- `services/` orquestan: reciben un payload validado, llaman al dominio, persisten con repos, emiten eventos WS.
- `http/` solo valida con schema y delega en services. Sin lógica de negocio.
- `infra/` contiene los detalles técnicos. Si mañana cambiamos SQLite por Postgres, solo se toca aquí.

---

## Módulo `node:sqlite` nativo

```ts
import { DatabaseSync } from "node:sqlite";

export function openDb(path: string) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = NORMAL");
  return db;
}
```

### Notas operativas

- **API síncrona**. Igual que `better-sqlite3`. Las llamadas son rápidas (microsegundos) pero deben evitarse en hot paths del event loop.
- **WAL mode** habilitado para concurrencia lectores/escritor.
- **Migraciones idempotentes**: tabla `_migrations(version, applied_at)`. Aplicar al boot.
- **Backup**: `db.backup(path)` (API nativa). PM2 cron job semanal.
- **Path de prod**: `./data/teimas-space.db`. Volumen montado en deploy.
- **Path de test**: `:memory:` reseteado por test.

### Schema base (resumen)

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','member')),
  is_invited_external INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE offices (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  tmj_filename TEXT NOT NULL,           -- Tiled JSON map exportado (.tmj)
  tile_width INTEGER NOT NULL,          -- píxeles por tile (extraído del tmj)
  tile_height INTEGER NOT NULL,
  cells_x INTEGER NOT NULL,             -- nº de tiles a lo ancho
  cells_y INTEGER NOT NULL,
  map_width INTEGER NOT NULL,           -- cells_x * tile_width
  map_height INTEGER NOT NULL,          -- cells_y * tile_height
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE office_tilesets (
  id INTEGER PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,             -- índice dentro del array tilesets[] del tmj
  image_name TEXT NOT NULL,             -- nombre que aparece en el tmj (p.ej. "office_tiles.png")
  filename TEXT NOT NULL,               -- nombre real persistido (con hash)
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/webp')),
  UNIQUE(office_id, ordinal),
  UNIQUE(office_id, image_name)
);

CREATE TABLE desks (
  id INTEGER PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  x INTEGER NOT NULL,                                          -- coord absoluta sobre el mapa, en píxeles
  y INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','tiled')),   -- origen del desk
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(office_id, label)
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  desk_id INTEGER NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                -- YYYY-MM-DD
  type TEXT NOT NULL CHECK (type IN ('daily','fixed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(desk_id, date)
);
CREATE INDEX idx_bookings_user_date ON bookings(user_id, date);
CREATE INDEX idx_bookings_office_date ON bookings(date);

CREATE TABLE invitations (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  invited_by_user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE _migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Autenticación con Google

### Flujo

```
[FE] click "Login con Google"
   │
   ▼
[Google] consent → callback con id_token
   │
   ▼
[BE] POST /api/auth/google { idToken }
       └─► google-auth-library.verifyIdToken(idToken, audience: CLIENT_ID)
       └─► validar payload.hd ∈ TEIMAS_DOMAINS  OR  email ∈ invitations(accepted=null)
       └─► upsert users
       └─► set-cookie session=<jwt firmado>  (HttpOnly, Secure, SameSite=Lax)
   │
   ▼
[FE] navega autenticado
```

### Reglas

- **Validación server-side del `hd`**. El parámetro `hd=teimas.com` en la URL de OAuth es solo UI; siempre se valida el `hd` del payload del ID token tras `verifyIdToken`.
- **Lista de dominios permitidos** en `env`: `TEIMAS_DOMAINS=teimas.com,teimas.es`. El usuario externo invitado no tiene `hd` que coincida; pasa por la rama "tiene invitación válida".
- **Cookie de sesión**: JWT firmado con HS256, secret en env, expiración 7 días, rotación silenciosa.
- **Sin contraseñas**, sin tabla `passwords`.

### Roles

- `admin`: bootstrap por seed inicial leyendo lista de emails de `env.ADMIN_EMAILS`. Después un admin puede promover.
- `member`: cualquier usuario de los dominios permitidos.

---

## Invitaciones a externos

```
admin POST /api/invitations { email }
   └─► insert invitations(token, expires_at = now+7d)
   └─► (futuro) email con link  /invite/:token
externo abre link → login con Google del email exacto
   └─► POST /api/auth/google { idToken, inviteToken? }
       └─► si email matches y token vivo → upsert user con is_invited_external=1
       └─► marca invitations.accepted_at
```

El externo **siempre** se autentica con Google, no se generan credenciales propias.

---

## WebSockets

### Diseño

- Un WS por oficina: `wss://host/ws/offices/:id`.
- Cookie de sesión validada en el upgrade. Sin cookie → 401.
- El servidor mantiene un `Hub` con rooms `office:<id>`.
- Eventos:

```ts
type WsMessage =
  | { type: "desk.booked";    deskId: number; date: string; user: PublicUser }
  | { type: "desk.released";  deskId: number; date: string }
  | { type: "desk.fixed";     deskId: number; user: PublicUser }
  | { type: "desk.unfixed";   deskId: number }
  | { type: "office.updated"; officeId: number };  // mapa o desks cambiaron
```

- El cliente recibe el snapshot inicial vía REST (`GET /api/offices/:id?date=YYYY-MM-DD`) y luego se suscribe al WS para deltas. Esto evita race conditions entre carga inicial y mensajes.

### Por qué WS y no SSE

- Los eventos van **en ambas direcciones**: el cliente puede mandar un `ping` para saber si la conexión sigue viva, y en el futuro podría enviar "estoy mirando este desk" sin un POST.
- WS es lo que el usuario pidió como opción y encaja mejor con Phaser, que ya tiene un loop propio.

---

## Logging — Winston

```ts
import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
  ),
  defaultMeta: { service: "teimas-space" },
  transports: [
    new transports.Console(),
    new transports.DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});
```

### Reglas

- **JSON estructurado** siempre. Nada de `console.log`.
- **Niveles**: `debug` solo en dev, `info` en prod, `warn` y `error` siempre.
- **Sin PII** en logs: no logear emails completos, solo dominio + hash; no logear tokens; no logear bodies completos.
- **Request ID** correlacionado entre HTTP, repos y WS via `AsyncLocalStorage`.

---

## Errors y alertas — Sentry

```ts
import * as Sentry from "@sentry/node";
import { addBreadcrumbs } from "@sentry/winston-transport";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
    integrations: [
      // captura logs de Winston nivel >= error
    ],
  });
}
```

### Reglas

- Solo activado en `production` y `staging`. En dev y test, DSN vacío → no-op.
- **PII scrubbing** activado.
- **Release** = git sha, inyectado por PM2.
- **Alertas** configuradas en Sentry UI: error rate > 1% / 5 min → Slack.

---

## PM2

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "teimas-space",
    script: "./dist/server.js",
    instances: "max",            // cluster mode
    exec_mode: "cluster",
    max_memory_restart: "512M",
    env: { NODE_ENV: "production" },
    error_file: "./logs/pm2-err.log",
    out_file: "./logs/pm2-out.log",
    time: true,
    kill_timeout: 5000,
  }],
};
```

### Reglas operativas

- `pm2 startup systemd && pm2 save` en el host.
- **Cluster mode** con N instancias = vCPUs. Atención: SQLite con WAL soporta múltiples lectores y un único escritor → si hay >1 instancia, los escritores serializan en kernel. Para esta carga (oficina pequeña) es suficiente. Si crece, bajar a 1 instancia o migrar a Postgres.
- `pm2 logs --json` para integrar con cualquier shipper.

---

## Variables de entorno

```
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

DB_PATH=./data/teimas-space.db

GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
TEIMAS_DOMAINS=teimas.com,teimas.es
ADMIN_EMAILS=ludo.bermejo@teimas.com

SESSION_SECRET=<256 bits>
SESSION_TTL_DAYS=7

SENTRY_DSN=

OFFICE_MAPS_DIR=./data/maps
MAX_TMJ_BYTES=1048576
MAX_TILESET_BYTES=2097152
MAX_MAP_TOTAL_BYTES=10485760
```

Validación con Zod al boot. Si falta cualquier obligatoria, el proceso muere antes de aceptar tráfico.

---

## Endpoints REST

```
POST   /api/auth/google           { idToken, inviteToken? }     → set cookie
POST   /api/auth/logout                                           → clear cookie
GET    /api/me                                                    → user actual

GET    /api/offices                                               → lista
POST   /api/offices               admin, multipart (tmj + tilesets) → 201
GET    /api/offices/:id?date=…                                    → snapshot del día
PATCH  /api/offices/:id           admin, replace map               → 200
GET    /maps/:officeId/:filename                                   → tmj o tileset

POST   /api/offices/:id/desks     admin, body { label, x, y }      → 201
PATCH  /api/desks/:id             admin, body { label?, x?, y? }   → 200
DELETE /api/desks/:id             admin                            → 204

POST   /api/desks/:id/bookings    body { date }                   → 201
DELETE /api/desks/:id/bookings    body { date }                   → 204
POST   /api/desks/:id/fixed       admin, body { userId }          → 200
DELETE /api/desks/:id/fixed       admin                            → 204

POST   /api/invitations           admin, body { email }            → 201
DELETE /api/invitations/:id       admin                            → 204
GET    /api/invitations           admin                            → lista
```

### Validación

Todos los inputs con `@fastify/type-provider-zod`. El schema vive junto al handler. La respuesta de error sigue RFC 7807 (problem+json).

---

## Subida de mapas (Tiled)

El admin diseña la oficina en [Tiled](https://www.mapeditor.org/) y exporta:

- Un mapa `.tmj` (Tiled JSON, **uncompressed**) con tilesets **embebidos**.
- Una o más imágenes de tileset (PNG o WebP) referenciadas por el `.tmj`.

**Formatos aceptados**:
- Mapa: `application/json` con extensión `.tmj` (validado por contenido: campos `type: "map"`, `version`, `tilewidth`, `tileheight`, `tilesets`).
- Tilesets: `image/png`, `image/webp`.

**Restricciones del mapa**:
- `orientation: "orthogonal"` (no isométrico ni hexagonal en v1).
- `tile_width` y `tile_height` ∈ `[8, 64]`.
- `cells_x * tile_width ≤ 4096` y `cells_y * tile_height ≤ 4096` (mapa final ≤ 4K × 4K px).
- Tile layers con encoding `csv` o `base64` **uncompressed** (sin gzip/zstd).
- ≤ 8 tilesets por mapa.
- Tilesets **embebidos** (sin `source: ".tsj"` externo). Cada tileset referencia su `image` por nombre de fichero relativo.

**Límites de upload**:
- `.tmj`: ≤ 1 MB.
- cada tileset: ≤ 2 MB.
- total multipart: ≤ 10 MB.

**Almacenamiento**:
- `OFFICE_MAPS_DIR/{officeId}/map_{sha256[:12]}.tmj`
- `OFFICE_MAPS_DIR/{officeId}/tile_{ordinal}_{sha256[:12]}.{ext}`

**Servido**:
- `GET /maps/:officeId/:filename` con `Cache-Control: public, max-age=31536000, immutable`.
- Nombre validado contra regex estricta para impedir path traversal.

**Validación de coherencia (al subir)**:
- El conjunto de PNG subidos debe coincidir 1:1 con los `image` referenciados por los tilesets del `.tmj` (mismo nombre).
- Cada tileset PNG debe tener dimensiones `≥ tilewidth × tileheight`.
- Layers no vacíos.

**Object layer "desks"** (opcional pero recomendado):
- Si el `.tmj` contiene un object layer cuyo `name` es exactamente `"desks"`, los objetos `point: true` de ese layer se importan como Desks: `label = object.name`, `x = round(object.x)`, `y = round(object.y)`.
- Los objetos rectángulo (`width > 0`) toman el centro como `(x, y)`.
- Cualquier objeto que falle validación se reporta en la respuesta como warning per-objeto, no aborta la subida.

---

## Geometría de zonas (puestos)

Cada desk es un **punto** `(x, y)` sobre el mapa subido (origen top-left, en píxeles del mapa). El frontend lo pinta como un cuadrado de ancho fijo `DESK_SIZE_PX` (constante compartida, default 48 px) centrado en ese punto. Hit testing = punto-en-rect, trivial.

### Constantes compartidas

```ts
// packages/shared/src/desk.ts
export const DESK_SIZE_PX = 48;
export const DESK_HALF = DESK_SIZE_PX / 2;
export const DESK_MIN_SEPARATION = DESK_SIZE_PX + 4; // sin solape + 4 px de aire
```

### Validación

- `0 ≤ x ≤ map_width`, `0 ≤ y ≤ map_height` (margen de medio cuadrado para que el render no salga del mapa: opcional, configurable).
- Distancia Chebyshev a cualquier otro desk de la misma oficina ≥ `DESK_MIN_SEPARATION` (los cuadrados no se solapan).
- Etiqueta única por oficina.

---

## Manejo de fechas y zonas horarias

- **Backend opera en UTC**. Las fechas de booking se guardan como `YYYY-MM-DD` literal.
- **El día** es responsabilidad del cliente: el frontend resuelve "qué es hoy" en la TZ del usuario y manda la fecha al backend.
- **Fixed bookings** se materializan en filas `bookings` con `type='fixed'` cuando se crea el fixed. Para no inflar la tabla por años, se materializan **bajo demanda**: cuando el frontend pide un día, el backend genera virtualmente las fixed bookings ausentes y las inserta. Alternativa: tabla `fixed_assignments` y JOIN al consultar; preferible, evita escrituras silenciosas. Decisión final en design del change `008-fixed-desk-assignment`.

---

## Operativa: arranque, salud, cierre

- `GET /healthz` → `{ status: "ok", db: "ok", sentry: "off|on" }`.
- Cierre limpio: `SIGTERM` → cerrar WS hub → `await server.close()` → `db.close()`.
- PM2 espera `kill_timeout` antes de `SIGKILL`.

---

## Roadmap de seguridad

- Rate limit por IP en `/api/auth/google` (10 req / min) con `@fastify/rate-limit`.
- CORS estricto: solo el origen del frontend.
- CSP en respuestas HTML.
- Cookies `Secure` + `SameSite=Lax` + `HttpOnly`.
- Auditar `dompurify` para SVG y mantener actualizada la lista de tags permitidos.
- Renovación automática de `SESSION_SECRET` con doble clave (kid en JWT) cada 90 días.

---

## Fuentes consultadas

- [SQLite — Node.js v25 docs](https://nodejs.org/api/sqlite.html)
- [Native SQLite in Node.js — Better Stack](https://betterstack.com/community/guides/scaling-nodejs/nodejs-sqlite/)
- [Google OAuth web server — Google for Developers](https://developers.google.com/identity/protocols/oauth2/web-server)
- [google-auth-library Node.js reference](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest)
- [Winston production logging — Dash0](https://www.dash0.com/guides/winston-production-logging-nodejs)
- [Winston + PM2 monitoring — daydreamsoft](https://daydreamsoft.com/blog/monitoring-and-logging-node-js-applications-with-pm2-and-winston)
- [Real-Time WebSockets 2026 — ZeonEdge](https://zeonedge.com/nl/blog/building-real-time-applications-websockets-2026-architecture-scaling)
- [Sentry JavaScript logging guide 2026](https://blog.sentry.io/javascript-logging-library-definitive-guide/)
