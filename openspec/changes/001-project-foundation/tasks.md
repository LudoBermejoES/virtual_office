# Tareas: Project Foundation

## 1. Monorepo

- [ ] 1.1 Crear `package.json` raíz con workspaces y scripts (`dev`, `build`, `start`, `test`, `typecheck`, `lint`).
- [ ] 1.2 Crear `pnpm-workspace.yaml` con `backend`, `frontend`, `packages/*`.
- [ ] 1.3 Añadir `.gitignore` (node_modules, data/, dist/, logs/, .env*).
- [ ] 1.4 Crear `packages/shared/` con `package.json`, `tsconfig.json`, `src/types.ts` (placeholder).

## 2. Backend bootstrap

- [ ] 2.1 `backend/package.json` con dependencias: fastify, @fastify/cookie, @fastify/cors, @fastify/multipart, @fastify/websocket, @fastify/rate-limit, @fastify/type-provider-zod, zod, ws, winston, winston-daily-rotate-file, @sentry/node, google-auth-library, dompurify, image-size.
- [ ] 2.2 `tsconfig.json` con strict, ESM, target es2024, moduleResolution NodeNext.
- [ ] 2.3 `src/config/env.ts` con schema Zod y validación al boot.
- [ ] 2.4 `src/config/logger.ts` con Winston (Console + DailyRotateFile en prod).
- [ ] 2.5 `src/infra/observability/sentry.ts` con init condicional a `SENTRY_DSN`.

## 3. Base de datos

- [ ] 3.1 `src/infra/db/sqlite.ts` wrapper de `node:sqlite` con WAL + FK ON.
- [ ] 3.2 `src/infra/db/migrations.ts` runner idempotente que lee `migrations/*.sql` por orden y registra en `_migrations`.
- [ ] 3.3 `src/infra/db/migrations/0001_init.sql` con tablas `users`, `offices` (con campos Tiled: `tmj_filename`, `tile_width`, `tile_height`, `cells_x`, `cells_y`, `map_width`, `map_height`), `office_tilesets`, `desks` (con `x` y `y`), `bookings`, `invitations`, `_migrations` e índices del documento `doc/be/README.md`.
- [ ] 3.4 Hook de cierre limpio que llama `db.close()` en `SIGTERM`/`SIGINT`.

## 4. Fastify y health

- [ ] 4.1 `src/server.ts` que compone env, logger, sentry, db, server y arranca.
- [ ] 4.2 `src/http/plugins/error-handler.ts` con respuestas problem+json.
- [ ] 4.3 `src/http/routes/health.ts` con `GET /healthz` reportando db y sentry.
- [ ] 4.4 Cierre limpio: `SIGTERM` → `server.close()` → `db.close()` antes de exit.

## 5. PM2

- [ ] 5.1 `backend/ecosystem.config.cjs` con `cluster`, `max_memory_restart`, paths de logs separados de Winston.
- [ ] 5.2 Documentar comandos: `pm2 start ecosystem.config.cjs --env production`, `pm2 save`, `pm2 startup systemd`.

## 6. Frontend bootstrap

- [ ] 6.1 `frontend/package.json` con dependencias: phaser@4, vite, typescript, zustand.
- [ ] 6.2 `vite.config.ts` con alias `@shared` → `packages/shared/src`.
- [ ] 6.3 `index.html` con `<div id="game"></div>` y `<div id="ui"></div>`.
- [ ] 6.4 `src/style.css` con `@font-face` para Press Start 2P y VT323, variables CSS de tema.
- [ ] 6.5 `public/fonts/` con los `.woff2` de las dos fuentes (descargados de Google Fonts).
- [ ] 6.6 `src/main.ts` que: precarga fuentes (`document.fonts.load`), crea Phaser.Game con BootScene.
- [ ] 6.7 `src/scenes/BootScene.ts` que muestra "PRESS START — LOADING…" y hace fetch a `/healthz`.
- [ ] 6.8 `src/config.ts` con `BASE_URL` y `WS_BASE` desde `import.meta.env`.

## 7. Tests de la fundación (TDD)

> Aunque la infraestructura completa de tests llega en el change `002`, esta fundación añade tests mínimos para `env`, `migrations` y `health` para validar que el scaffolding es testeable.

- [ ] 7.1 Test unit: `env.ts` falla si falta `SESSION_SECRET`.
- [ ] 7.2 Test unit: `migrations.ts` aplica solo lo que falta y registra la versión.
- [ ] 7.3 Test integration: `GET /healthz` devuelve 200 con `db: "ok"`.

## 8. Verificación

- [ ] 8.1 `pnpm typecheck` en verde para los tres paquetes.
- [ ] 8.2 `pnpm build` produce `backend/dist/` y `frontend/dist/`.
- [ ] 8.3 `pm2 start backend/ecosystem.config.cjs` arranca sin warnings.
- [ ] 8.4 Abrir `http://localhost:5173` muestra "PRESS START — LOADING…" con la fuente Press Start 2P sin FOUT.
