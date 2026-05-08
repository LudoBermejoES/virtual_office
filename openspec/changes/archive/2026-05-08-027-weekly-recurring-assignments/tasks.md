# Tasks

## 1. Modelo de datos compartido (dow helper)

- [x] 1.1 Helper `dowOfDate(isoDate: string): number` en `packages/shared/src/dow.ts` (0=lunes ... 6=domingo). 6 tests unit verde. Etiquetas `DOW_LABELS_ES` y `DOW_LABELS_LONG_ES` también exportadas.

## 2. Migración SQL

- [x] 2.1 Migración `0008_weekly_assignments.sql` con tabla `weekly_assignments` (UNIQUE (desk_id, dow) + UNIQUE (user_id, dow) + CHECK dow), tabla `weekly_assignment_exceptions` con CASCADE, e índices.
- [x] 2.2 Test integración (4 tests passing) verifica esquema, CHECK, índices.

## 3. Repo `weekly-assignments`

- [x] 3.1–3.8 Repo `weekly-assignments` con `createWeekly`, `deleteWeeklyById`, `findByDeskAndDow`, `listByOffice`, `findActiveForDeskDate`, `findActiveForUserDate`, `listActiveForOfficeDate`, `createException`. Excepción `WeeklyAssignmentConflict` con columna `desk_dow|user_dow`. **9 tests** unit verde.

## 4. Cómputo de bookings de un día (refactor)

- [x] 4.1–4.5 Cómputo del detalle de oficina extendido: weeklies del dow se proyectan en `bookings[]` con `type: "weekly"` cuando no hay daily ni fixed sobre el desk y el usuario no tiene otra reserva ese día. **7 tests** integración verde (proyección, dow distinto, excepción suprime, daily prevalece, otro desk no interfiere, dos weeklies coexisten, fixed gana ante inconsistencia).

## 5. Endpoints CRUD weekly

- [x] 5.1–5.9 Endpoints `POST/DELETE/GET` en nuevo `backend/src/http/routes/weekly.ts`, registrados en `server.ts`. **12 tests** integración verde (admin/no-admin, dow fuera de rango, userId inexistente, desk con fixed, conflictos desk_dow y user_dow, DELETE 204, GET listado enriquecido).

## 6. UI: extensión del modal admin (change 026)

- [x] 6.1 Test unit: modal en modo `book` muestra 7 checkboxes (L M X J V S D) por usuario.
- [x] 6.2 Test unit: marcar/desmarcar checkboxes y guardar produce `weeklyChanges = { create, deleteIds }` correcto.
- [x] 6.3 Test unit: dow conflictivo en otro desk → checkbox `disabled` con `title` explicativo.
- [x] 6.4 [admin-book-modal.ts](frontend/src/ui/admin-book-modal.ts) ampliado con `WeeklyByUser` + `ConflictingDowsByUser` + `WeeklyChanges`. Botón cambia de "Reservar" a "Guardar" para reflejar el alcance combinado. 13 tests modal (5 nuevos del 027).
- [x] 6.5 `OfficeScene.openAdminBookModal` carga en paralelo `/api/users` y `/api/offices/:id/weekly`, construye `weeklyByUser` (mismo desk) y `conflictingDowsByUser` (otros desks), monta el modal.
- [x] 6.6 `onConfirmBook` aplica deltas en serie: primero DELETEs, luego POSTs; si alguna falla muestra feedback HUD y se detiene; si hay `userId` además crea reserva diaria con `reserveDeskFor`.

## 7. Validación final

- [x] 7.1 `openspec validate --all --strict` → 9/9 passed.
- [x] 7.2 `pnpm typecheck && pnpm lint && pnpm format:check` clean.
- [x] 7.3 `pnpm test` → 645/645 (backend 393 + frontend 210 + tools 42).
