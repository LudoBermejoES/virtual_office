# Virtual Office (Teimas Space)

Una oficina virtual con estética videojuego para que el equipo escoja su puesto del día sobre un mapa diseñado en [Tiled](https://www.mapeditor.org/) y vea en tiempo real quién está sentado dónde.

> **Estado**: en producción en [https://teimas.ludobermejo.es](https://teimas.ludobermejo.es). 19 changes OpenSpec implementados y archivados, 1 en backlog (`019-voice-rooms-mvp`, salas de voz tipo Discord ancladas a zonas Tiled).

---

## Qué es

- **Login solo con Google** (validación server-side del claim `hd`).
- **Multi-oficina**: un mismo despliegue puede albergar varias oficinas con sus propios mapas, puestos y office-admins.
- **Admins pueden invitar a externos** vía email; el invitado igualmente entra con Google.
- **Mapa de la oficina** = bundle Tiled (`.tmj` + tilesets PNG/WebP), renderizado en Phaser 4.
- **Puestos** definidos como puntos `(x, y)` (chinchetas) sobre el mapa, con cuadrado de ancho fijo. Se importan automáticamente desde un object layer `desks` del Tiled.
- **Reserva diaria** de un puesto, con UNIQUE `(desk, fecha)` y `(usuario, fecha)`.
- **Asignación de puesto fijo** por parte de admin, con **excepciones puntuales por día** ("hoy no voy") que liberan el puesto a otros.
- **Visibilidad en tiempo real con WebSocket**: si reservas, todos lo ven sin recargar.
- **Zonas y NPCs** importados del TMJ, con salas con nombre y sprites animados.
- **Selector de oficina** en HUD, navegación entre días con atajos `←`/`→`.
- **Avatar Google** con máscara circular sobre el puesto ocupado, clicable para reservar/liberar.
- **Panel de administración** (overlay HTML) para crear oficinas, subir mapas, invitar usuarios y gestionar puestos fijos.
- **Tipografía pixel** Press Start 2P (titulares) + VT323 (cuerpo) sobre paleta arcade.

---

## Stack

| Capa | Elección | Notas |
|------|----------|-------|
| Runtime | **Node.js 24+** | con `node:sqlite` nativo (sin `better-sqlite3`) |
| Lenguaje | **TypeScript** estricto | back y front |
| HTTP | **Fastify 5** + `@fastify/websocket` + `@fastify/static` | |
| BD | **SQLite** (`node:sqlite`) | WAL, foreign_keys ON, migraciones SQL idempotentes |
| Realtime | **WebSocket** (`ws`) | broadcast por oficina con `wss://` en producción |
| Auth | **Google OAuth** | `google-auth-library`, validación de `hd` |
| Logs | **Winston** + DailyRotateFile | JSON estructurado |
| Errores | **Sentry** (`@sentry/node`) | solo si `SENTRY_DSN` |
| Procesos | **PM2** fork mode | gestionado como `www-data` |
| Frontend | **Phaser 4** + **Vite 6** | tilemap nativo, fuentes con FontFace API |
| Estado FE | **zustand** vanilla | |
| Tests | **Vitest** + **Playwright** | TDD scenario-driven |
| Spec-driven | **OpenSpec** 1.2 | flujo `/opsx:propose`, `/opsx:apply`, `/opsx:archive` |
| CI/CD | **GitHub Actions** | tests + scp + ssh + PM2 a Oracle Cloud |

---

## Estructura del repo

```
.
├── README.md                  ← este fichero
├── CLAUDE.md                  ← guía persistente para Claude Code
├── package.json               ← root del workspace pnpm
├── pnpm-workspace.yaml
├── backend/                   ← Fastify + node:sqlite
│   ├── src/
│   │   ├── http/routes/       ← endpoints REST por dominio
│   │   ├── infra/db/migrations/  ← *.sql
│   │   ├── infra/repos/       ← capa de acceso a datos
│   │   ├── infra/ws/          ← hub WebSocket
│   │   ├── domain/            ← lógica pura
│   │   └── services/          ← parsers Tiled, auth, backups
│   ├── tests/{unit,integration}/
│   └── ecosystem.config.cjs   ← PM2
├── frontend/                  ← Phaser + Vite
│   ├── src/
│   │   ├── scenes/            ← Office, Login, NoOffice, AdminMap, HUD
│   │   ├── render/            ← desks, zonas, avatares, NPCs, sprites
│   │   ├── state/             ← stores zustand
│   │   ├── realtime/          ← cliente WS
│   │   └── ui/                ← admin panel, day navigation, sound
│   └── tests/{unit,e2e}/
├── packages/shared/           ← tipos y constantes compartidas
├── tools/                     ← utilidades CLI internas
│   └── tmj-optimize/          ← optimiza bundles Tiled (.tmj + WebP único)
├── doc/
│   ├── tests/README.md        ← estrategia TDD
│   ├── be/README.md           ← arquitectura backend
│   ├── fe/README.md           ← arquitectura frontend
│   └── deploy.md              ← guía de despliegue
├── scripts/bootstrap-server.sh   ← setup one-shot del servidor
├── openspec/
│   ├── README.md
│   ├── specs/                 ← fuente de verdad por capacidad
│   ├── changes/archive/       ← 19 changes implementados
│   └── changes/               ← (vacío salvo backlog)
├── .github/workflows/         ← ci.yml + deploy.yml
└── .claude/                   ← config y skills de Claude Code
```

---

## Estado de implementación

### Implementado y archivado

| # | Change | Resumen |
|---|--------|---------|
| 001 | project-foundation | Monorepo + Node + node:sqlite + Fastify + Phaser + Vite |
| 002 | testing-infrastructure | Vitest + Playwright |
| 003 | google-auth | Login con Google, sesión por cookie firmada, roles |
| 004 | external-invitations | Invitaciones admin → email externo |
| 005 | office-map-upload | Subida de bundle Tiled (`.tmj` + tilesets) |
| 006 | desk-zone-drawing | Pins manuales + import desde object layer "desks" |
| 007 | daily-desk-booking | Reserva diaria con UNIQUE (desk, date) y (user, date) |
| 008 | fixed-desk-assignment | Admin marca a alguien como ocupante fijo |
| 009 | realtime-occupancy | WebSocket broadcast por oficina |
| 010 | day-navigation | Navegación entre días en HUD + atajos |
| 011 | user-avatars | Avatar Google con máscara circular |
| 012 | videogame-typography | Pasada final de tema arcade |
| 013 | e2e-auth-helper-and-flows | Helper de auth simulada para Playwright |
| 014 | tiled-zones-and-rooms | Zonas con nombre, etiquetas, hover |
| 015 | animated-sprites-and-presence | Sprites animados desde Tiled, NPCs |
| 016 | multi-office-selector | Varias oficinas, selector en HUD |
| 017 | operational-readiness | `/healthz`, `/readyz`, `/metrics`, backups, Sentry, PM2 |
| 018 | admin-panel | Panel HTML con pestañas Oficinas / Usuarios / Fijos |
| 020 | fixed-day-exceptions | "Hoy no vengo" para puestos fijos |

### En backlog

| # | Change | Resumen |
|---|--------|---------|
| 019 | voice-rooms-mvp | Salas de voz LiveKit ancladas a zonas Tiled (auto-join, kick/mute admin, indicadores) |

Roadmap futuro de voz en `openspec/roadmap/` (controles, vídeo, screenshare, audio espacial).

---

## Desarrollo local

```bash
# Instalar dependencias
pnpm install

# Configurar entorno
cp backend/.env.example backend/.env
# Editar backend/.env con SESSION_SECRET (≥32 chars), GOOGLE_CLIENT_ID, ADMIN_EMAILS, etc.

# Arrancar backend (puerto 8080) y frontend (puerto 5173) en paralelo
pnpm dev
```

Frontend en [http://localhost:5173](http://localhost:5173) con proxy a `/api/*` y `/ws`.

### Promover un usuario a super-admin

Si necesitas un primer administrador (o promover a alguien que ya existe en la BD), ejecuta desde `backend/`:

```bash
pnpm bootstrap:admin usuario@ejemplo.com
```

El script actualiza el campo `role='admin'` para ese email. Si el usuario no existe todavía (no ha hecho login), el script termina sin error y la promoción se aplicará en cuanto el usuario entre por primera vez.

---

## Tests

```bash
pnpm test          # vitest unit + integration (backend + frontend)
pnpm typecheck
pnpm lint
pnpm format:check
pnpm --filter frontend e2e:chromium   # Playwright
```

Estado actual: **402 tests verde** (300 backend + 102 frontend).

---

## Despliegue

Push a `main` → CI tests → build → scp + ssh + PM2 reload en `teimas.ludobermejo.es`.

Detalles completos en [`doc/deploy.md`](doc/deploy.md):

- Servidor Oracle Cloud (aarch64), Ubuntu 24.04, Node 25 vía NVM, PM2 como `www-data`.
- Nginx termina TLS y proxy a `localhost:8123`.
- Datos persistentes en `/var/www/teimas-space/backend/data/` (SQLite + maps + backups).
- Bootstrap inicial con `scripts/bootstrap-server.sh` (crea estructura, nginx, certbot).
- Secrets en GitHub Actions (`SSH_*`, `SESSION_SECRET`, `GOOGLE_CLIENT_*`, etc.).

---

## OpenSpec

Validar todos los specs:

```bash
openspec validate --all --strict
```

Listar changes activos:

```bash
openspec list
```

Slash commands de Claude Code:

```text
/opsx:propose <nombre>     ← crea proposal + design + tasks + delta specs
/opsx:apply <nombre>       ← implementa el tasks.md con TDD
/opsx:archive <nombre>     ← fusiona delta specs y mueve a archive/
```

---

## Documentación clave

- [Estrategia TDD](doc/tests/README.md) — pirámide, herramientas, mapeo Scenario → test, anti-patrones.
- [Arquitectura backend](doc/be/README.md) — schema SQL, endpoints, WS, observabilidad, PM2.
- [Operaciones](doc/be/OPERATIONS.md) — backups, restore, `/metrics`, `/readyz`, Sentry, troubleshooting.
- [Arquitectura frontend](doc/fe/README.md) — Phaser tilemap, escenas, render con Tiled, tipografía.
- [Despliegue](doc/deploy.md) — workflow GitHub Actions, layout en servidor, rollback.
- [Referencia OpenSpec](doc/openspec/README.md) — qué es, cómo se usa el CLI y los `/opsx:*`.

---

## Convenciones

- **Idioma**: documentación, comentarios, commit messages, tests, scenarios y mensajes de error de usuario en **castellano**. Identificadores de código en inglés.
- **TDD obligatorio**: cada `#### Scenario:` de un spec produce un test que se escribe **antes** del código.
- **Lint, typecheck y format en verde** antes de cerrar un change.
- **Sin secretos en el repo**: `.env*` están gitignorados; usa `.env.example` (dev) o `.env.production.example` (prod) como plantillas.
- **Sin PII en logs**: ni emails completos, ni tokens, ni payloads de auth.

---

## Licencia

TBD.

---

## Créditos

Diseñado y desarrollado por **Ludo Bermejo** ([@LudoBermejoES](https://github.com/LudoBermejoES)) con asistencia de Claude Code (Opus 4.7, contexto 1M) en pareja.
