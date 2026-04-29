# Propuesta: Project Foundation

## Motivación

Levantar el monorepo y la base sobre la que se construirá toda la oficina virtual. Sin esto no hay backend que arrancar, frontend que servir, ni base de datos a la que escribir. El stack está fijado por el usuario: Node.js LTS más reciente con `node:sqlite` nativo, Phaser 4 en frontend, Winston/Sentry/PM2 en producción.

## Alcance

**En scope:**
- Monorepo con `backend/`, `frontend/` y `packages/shared/` para tipos comunes.
- Backend: Node.js 24 LTS, TypeScript, Fastify, `node:sqlite`, Winston, Sentry SDK, ecosystem PM2.
- Frontend: Phaser 4, TypeScript, Vite 6, fuentes Press Start 2P y VT323 cargadas vía FontFace.
- Esquema de variables de entorno validado con Zod al boot.
- Migraciones SQL versionadas e idempotentes con tabla `_migrations`.
- Endpoint `/healthz` que reporta estado del proceso, DB y Sentry.
- Carga sanitizada del SVG cuando se sirva en el futuro (preparar la dependencia `dompurify`).

**Fuera de scope:**
- Cualquier endpoint funcional (auth, offices, bookings) — vive en sus propios changes.
- CI/CD pipelines (se trata como ops fuera del flow OpenSpec).
- Testing infrastructure — change `002`.

## Dominios afectados

`autenticacion` (parcial, solo el shape de `users`), `oficinas`, `puestos`, `reservas`, `invitaciones`. La fundación define el schema base de todas las tablas porque las migraciones son monolíticas más fáciles de razonar al inicio del proyecto.

## Orden y dependencias

Change `001`. Sin dependencias previas. Bloquea a todo el resto.

## Impacto de seguridad

- Define la cookie de sesión (HttpOnly, Secure, SameSite=Lax) aunque no la emite todavía.
- Define el secret de sesión y su rotación (preparada, no automatizada todavía).
- Sentry init solo si `SENTRY_DSN` está definido — en dev y test queda no-op.

## Rollback

Eliminar las carpetas `backend/`, `frontend/`, `packages/shared/`. La SQLite vive en `data/teimas-space.db` y puede borrarse libremente; al volver a arrancar las migraciones la recrean.
