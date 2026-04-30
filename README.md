# Virtual Office (Teimas Space)

Una oficina virtual con estética videojuego para que el equipo escoja su puesto del día sobre un mapa diseñado en [Tiled](https://www.mapeditor.org/) y vea en tiempo real quién está sentado dónde.

> **Estado**: en fase de specs. Este repositorio contiene únicamente la documentación, la estrategia TDD y los 12 *changes* OpenSpec en orden de implementación. El código vendrá al ejecutar el primer change `001-project-foundation`.

---

## Qué es

- Login solo con Google (validación server-side del claim `hd`).
- Admins pueden invitar a externos vía email; el invitado igualmente entra con Google.
- Mapa de la oficina = bundle Tiled (`.tmj` + tilesets PNG/WebP), renderizado en Phaser 4.
- Puestos definidos como puntos `(x, y)` (chinchetas) sobre el mapa, con cuadrado de ancho fijo. Se pueden importar automáticamente desde un object layer `desks` del Tiled.
- Reserva diaria de un puesto, con UNIQUE `(desk, fecha)` y `(usuario, fecha)`.
- Asignación de "puesto fijo" por parte de admin.
- Visibilidad en tiempo real con WebSocket: si reservas, todos lo ven sin recargar.
- Navegación entre días con teclas `←`/`→` y botón "Hoy".
- Foto del usuario con máscara circular sobre el puesto ocupado (avatar de Google por defecto).
- Tipografía pixel: Press Start 2P (titulares) + VT323 (cuerpo).

---

## Stack

| Capa | Elección | Notas |
|------|----------|-------|
| Runtime | **Node.js 24 LTS** | con `node:sqlite` nativo |
| Lenguaje | **TypeScript** estricto | back y front |
| HTTP | **Fastify** + `@fastify/websocket` | |
| BD | **SQLite** (`node:sqlite`) | WAL, foreign_keys ON |
| Realtime | **WebSocket** (`ws`) | broadcast por oficina |
| Auth | **Google OAuth** | `google-auth-library`, validación de `hd` |
| Logs | **Winston** + DailyRotateFile | JSON estructurado |
| Errores | **Sentry** (`@sentry/node`) | solo si `SENTRY_DSN` |
| Procesos | **PM2** cluster mode | |
| Frontend | **Phaser 4** + **Vite 6** | tilemap nativo |
| Estado FE | **zustand** | |
| Tests | **Vitest** + **Supertest** + **Playwright** | TDD |
| Spec-driven | **OpenSpec** 1.2 | `/opsx:*` |

---

## Estructura del repo

```
.
├── README.md                  ← este fichero
├── CLAUDE.md                  ← guía persistente para Claude Code
├── doc/
│   ├── tests/README.md        ← estrategia TDD
│   ├── be/README.md           ← arquitectura backend
│   ├── fe/README.md           ← arquitectura frontend
│   └── openspec/              ← referencia de OpenSpec (en castellano)
├── openspec/
│   ├── config.yaml            ← contexto y reglas inyectadas en cada artifact
│   ├── README.md              ← roadmap de los 12 changes
│   ├── specs/                 ← fuente de verdad (vacío hasta primer archive)
│   └── changes/
│       ├── 001-project-foundation/
│       ├── 002-testing-infrastructure/
│       ├── …
│       └── 012-videogame-typography/
└── .claude/
    ├── settings.json          ← config compartida (permisos, env)
    ├── skills/                ← skills (incluye las de OpenSpec)
    ├── commands/              ← slash commands
    └── agents/                ← subagentes (spec-reviewer, ...)
```

Cuando se ejecute `001-project-foundation` aparecerán además `backend/`, `frontend/`, `packages/shared/` y `data/` (gitignorado).

---

## Roadmap (12 changes en orden)

```
001 ─► 002 ─┬─► 003 ─► 004 ──────────────────────────┐
            │                                         │
            └─► 005 ─► 006 ─► 007 ─► 008 ─► 009 ─► 010 ─► 011 ─► 012
```

| # | Change | Resumen |
|---|--------|---------|
| 001 | project-foundation | Monorepo + Node + node:sqlite + Fastify + Winston/Sentry/PM2 + Phaser + Vite |
| 002 | testing-infrastructure | Vitest + Supertest + Playwright |
| 003 | google-auth | Login con Google, sesión por cookie firmada, roles |
| 004 | external-invitations | Invitaciones admin → email externo |
| 005 | office-map-upload | Subida de bundle Tiled (`.tmj` + tilesets) |
| 006 | desk-zone-drawing | Pins manuales + import desde object layer "desks" |
| 007 | daily-desk-booking | Reserva diaria con UNIQUE (desk, date) y (user, date) |
| 008 | fixed-desk-assignment | Admin marca a alguien como ocupante fijo |
| 009 | realtime-occupancy | WebSocket broadcast por oficina |
| 010 | day-navigation | Navegación entre días en HUD + atajos |
| 011 | user-avatars | Avatar Google con máscara circular |
| 012 | videogame-typography | Pasada final de tema arcade y regresión visual |

Detalle completo en [`openspec/README.md`](openspec/README.md).

---

## Cómo navegar

### Validar todos los specs

```bash
openspec validate --all --strict
```

Tiene que dar `12 passed, 0 failed`.

### Listar changes

```bash
openspec list
```

### Ver un change concreto

```bash
openspec show 005-office-map-upload
```

### Empezar a implementar (cuando llegue el momento)

En Claude Code:

```
/opsx:apply 001-project-foundation
```

El flujo TDD por scenario está documentado en [`doc/tests/README.md`](doc/tests/README.md).

### Promover un usuario a super-admin

Si necesitas un primer administrador (o promover a alguien que ya existe en la BD), ejecuta desde `backend/`:

```bash
pnpm bootstrap:admin usuario@ejemplo.com
```

El script actualiza el campo `role='admin'` para ese email. Si el usuario no existe todavía (no ha hecho login), el script termina sin error y la promoción se aplicará en cuanto el usuario entre por primera vez.

---

## Documentación clave

- [Estrategia TDD](doc/tests/README.md) — pirámide, herramientas, mapeo Scenario → test, anti-patrones.
- [Arquitectura backend](doc/be/README.md) — schema SQL, endpoints, WS, observabilidad, PM2.
- [Operaciones](doc/be/OPERATIONS.md) — backups, restore, `/metrics`, `/readyz`, Sentry, troubleshooting.
- [Arquitectura frontend](doc/fe/README.md) — Phaser tilemap, escenas, render con Tiled, tipografía.
- [Referencia OpenSpec](doc/openspec/README.md) — qué es, cómo se usa el CLI y los `/opsx:*`.

---

## Convenciones

- **Idioma**: documentación, comentarios, commit messages y tests en castellano. Identificadores de código en inglés.
- **TDD obligatorio**: cada `#### Scenario:` de un spec produce un test que se escribe **antes** del código.
- **Lint y typecheck en verde** antes de cerrar un change.
- **Coverage ≥ 80%** en líneas, statements, branches y funciones.
- **Sin secretos en el repo**: `.env*` están gitignorados; usa `.env.example` (dev) o `.env.production.example` (prod) como plantillas.
- **Sin PII en logs**: ni emails completos, ni tokens, ni payloads de auth.

---

## Licencia

TBD.

---

## Créditos

Diseñado y especificado por **Ludo Bermejo** ([@LudoBermejoES](https://github.com/LudoBermejoES)) con asistencia de Claude Code (Opus 4.7, contexto 1M) en pareja.
