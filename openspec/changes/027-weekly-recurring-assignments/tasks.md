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

- [ ] 6.1 Test unit: modal en modo `book` con prop `weeklyByUserId` muestra 7 checkboxes (L M X J V S D) por usuario.
- [ ] 6.2 Test unit: cambiar checkboxes acumula deltas (creates/deletes) y se aplican al pulsar "Guardar".
- [ ] 6.3 Test unit: si el usuario ya tiene weekly conflictivo (otro desk mismo dow), el checkbox de ese dow está disabled con tooltip explicativo.
- [ ] 6.4 Adaptar `frontend/src/ui/admin-book-modal.ts` añadiendo la prop `weeklyByUserId: Record<userId, dow[]>` y la columna de checkboxes.
- [ ] 6.5 En `OfficeScene.openAdminBookModal`, antes de montar el modal: cargar `GET /api/offices/:id/weekly` y filtrar por `desk_id = current` para precargar el estado de checkboxes.
- [ ] 6.6 Al pulsar "Guardar": ejecutar deltas (POST/DELETE weeklies) en serie, mostrar feedback en HUD si alguna falla.

## 7. Validación final

- [ ] 7.1 `openspec validate --all --strict` en verde.
- [ ] 7.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [ ] 7.3 `pnpm test` en verde (backend + frontend + tools).
