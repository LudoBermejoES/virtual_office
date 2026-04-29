# CLAUDE.md — Virtual Office (Teimas Space)

> Guía persistente para Claude Code. Cargada automáticamente en cada sesión.

## El proyecto en 30 segundos

Aplicación de oficina virtual:
- Login Google + admins invitan a externos.
- Mapa Tiled (`.tmj` + tilesets PNG/WebP) renderizado con Phaser 4.
- Puestos = puntos `(x, y)` con cuadrado fijo de `DESK_SIZE_PX` (48 px).
- Reserva diaria por usuario; admins pueden marcar puestos fijos.
- WebSocket por oficina para realtime.
- Estética videojuego: Press Start 2P + VT323 sobre paleta arcade.

**El repo todavía no tiene código de aplicación.** Solo docs, specs OpenSpec y el scaffolding `.claude/`. El código aparecerá cuando se ejecute `/opsx:apply 001-project-foundation`.

## Stack fijado (no proponer alternativas sin avisar)

- **Backend**: Node.js 24 LTS + TypeScript estricto, Fastify, `node:sqlite` nativo (NO `better-sqlite3` ni `sqlite3`), `ws`, `google-auth-library`, Winston + `winston-daily-rotate-file`, `@sentry/node`, PM2.
- **Frontend**: Phaser 4, Vite 6, TypeScript, zustand, fuentes Press Start 2P + VT323 cargadas con FontFace API antes de iniciar Phaser.
- **Tests**: Vitest (NO Jest), Supertest para integración HTTP, Playwright para e2e.
- **Spec-driven**: OpenSpec 1.2.

## Idioma

Toda la **documentación, comentarios, commit messages, descripciones de tests, mensajes de error visibles al usuario y nombres de Scenarios de specs** van en **castellano**.

Solo los **identificadores de código** (variables, funciones, clases, archivos) en inglés.

## Workflow OpenSpec

```
/opsx:propose <nombre>     → crea proposal.md, design.md, tasks.md, specs/ delta
/opsx:apply <nombre>       → implementa el tasks.md con TDD
/opsx:archive <nombre>     → fusiona delta specs en openspec/specs/ y mueve a archive/
```

Antes de hacer commit de cambios sobre OpenSpec ejecuta:

```bash
openspec validate --all --strict
```

Tiene que dar `12 passed, 0 failed` (o más, si se han añadido changes nuevos).

## TDD — regla dura

Cada `#### Scenario:` de un spec produce **un test** que se escribe **antes** del código.

```
1. Lee el Scenario del spec OpenSpec
2. Escribe el test (red)
3. Implementa lo mínimo para verlo green
4. Refactoriza sin tocar el test
5. Marca [x] en tasks.md y pasa al siguiente Scenario
```

Aplica a unit, integration y e2e por igual. La pirámide y los helpers de fixtures viven en [`doc/tests/README.md`](doc/tests/README.md).

## Reglas de arquitectura

- **Multi-capa estricta** en backend: `http → services → domain` y `services → infra`. `domain/` no importa de `infra/` ni de `http/`.
- **Tipos compartidos** en `packages/shared/` cuando ambos extremos los necesitan. Constantes como `DESK_SIZE_PX`, `DESK_MIN_SEPARATION` viven ahí.
- **Validación con Zod** en cada borde HTTP, WS y carga de archivos. Errores devueltos como `application/problem+json`.
- **DB con WAL + foreign_keys ON**. Migraciones SQL idempotentes en `backend/src/infra/db/migrations/NNNN_descripcion.sql`.
- **Sin mocks de DB en tests**: usar `:memory:` real con `setupTestDb()`.
- **Sin secretos en logs**: ni emails completos, ni tokens, ni id_token, ni `.tmj` content. Solo dominio, prefijo de token (≤6 chars) y bytes totales.

## Reglas del frontend

- **Estado de dominio fuera de Phaser**, en stores zustand. Las escenas leen del store, no guardan estado.
- **Modales y formularios en HTML overlay**, no en Phaser (a11y, teclado).
- **Fuentes pixel cargadas con `document.fonts.load(...)` ANTES de `new Phaser.Game(config)`** para evitar FOUT.
- **Mapa = tilemap Tiled** con `load.tilemapTiledJSON` + `addTilesetImage` + `createLayer`. Cada tile es internamente una [`Phaser.Tilemaps.Tile`](https://docs.phaser.io/api-documentation/class/tilemaps-tile).
- **Phaser config**: `pixelArt: true`, `roundPixels: true`, `Phaser.Scale.NEAREST`, `image-rendering: pixelated` global.
- **Importar puestos desde Tiled**: si el `.tmj` tiene un object layer llamado `desks`, los `point: true` y rectángulos se convierten en Desks con `source="tiled"`. La creación manual sigue disponible y se marca `source="manual"`.

## Seguridad

- Validación server-side del `hd` claim del ID token de Google. No fiarse del parámetro UI.
- Rate limit 10 req/min/IP en `/api/auth/google`.
- Cookie de sesión `HttpOnly`, `Secure`, `SameSite=Lax`, JWT HS256.
- CORS estricto al origen del frontend.
- En tilesets, solo PNG/WebP. JPEG produce artifacts y SVG no aplica al modelo Tiled.
- Subida de mapa con límites: `.tmj` ≤ 1 MB, cada tileset ≤ 2 MB, total ≤ 10 MB.
- Filenames servidos validados contra regex estricta para impedir path traversal.

## Permisos preconfigurados

`.claude/settings.json` tiene allowlist de comandos seguros (openspec, git, gh, npm, pnpm, npx, vitest, playwright). Si necesitas un comando nuevo y no está, pídelo al usuario en lugar de salir del allowlist.

## Cosas que NO debes hacer

- **No proponer Express** ni cambiar `Fastify`.
- **No proponer `better-sqlite3` ni `sqlite3`**: el requisito explícito del usuario es `node:sqlite` nativo.
- **No proponer Jest**: usamos Vitest.
- **No mockear `node:sqlite`** en tests: DB `:memory:` real.
- **No subir `.env`, `data/`, `node_modules/`, `*.db*`**: ya están en `.gitignore`.
- **No hacer push --force a `main`** sin confirmación explícita.
- **No saltarse hooks con `--no-verify`** salvo petición expresa.
- **No introducir nuevas fuentes ni colores fuera del tema** sin actualizar `doc/fe` y los specs de `012-videogame-typography`.

## Verificación rápida

Antes de cerrar un change:

```bash
# OpenSpec valida
openspec validate --all --strict

# Una vez exista código:
pnpm typecheck
pnpm lint
pnpm test                  # vitest unit + integration
pnpm e2e:chromium          # playwright
```

## Donde está cada cosa

| Necesitas… | Mira aquí |
|------------|-----------|
| Visión general del proyecto | `README.md` |
| Estrategia TDD completa | `doc/tests/README.md` |
| Arquitectura backend (schema SQL, endpoints, WS) | `doc/be/README.md` |
| Arquitectura frontend (escenas, tilemap, fuentes) | `doc/fe/README.md` |
| Cómo funciona OpenSpec | `doc/openspec/` |
| Roadmap de los 12 changes | `openspec/README.md` |
| El detalle de cada change | `openspec/changes/<NNN-nombre>/` |
| Slash commands `/opsx:*` | `.claude/commands/opsx/` |
| Skills de OpenSpec y propias | `.claude/skills/` |
| Subagentes del proyecto | `.claude/agents/` |

## Modelos

Por defecto, Opus 4.7 (1M). Para tareas mecánicas (lint, run-tests, validate) Haiku 4.5 sirve. Para diseño de changes y review crítico, Opus 4.7 o Sonnet 4.6.
