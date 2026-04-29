# Tareas: Daily Desk Booking

## 1. Backend: dominio

- [ ] 1.1 (test unit) `isInWindow(date, today, horizon)` true para hoy, mañana y horizonte; false para ayer y horizonte+1.
- [ ] 1.2 (test unit) `parseIsoDate` rechaza `2026-13-01`, `2026/05/04`, `null`.
- [ ] 1.3 (test unit) `deskState` devuelve `free`/`mine`/`occupied`/`fixed` según fixture.

## 2. Backend: migración

- [ ] 2.1 `migrations/0002_bookings_indexes.sql` con índice parcial `idx_bookings_user_date_daily`.
- [ ] 2.2 (test integration) Tras correr migraciones existe el índice (consultar `sqlite_master`).

## 3. Backend: repos

- [ ] 3.1 `src/infra/repos/bookings.ts` con `create`, `deleteBy`, `findBy`, `listByOfficeAndDate`.
- [ ] 3.2 (test unit) `create` propaga error de UNIQUE constraint.

## 4. Backend: endpoints

- [ ] 4.1 (test integration) `POST /api/desks/:id/bookings { date }` autenticado en futuro próximo → 201.
- [ ] 4.2 (test integration) `POST` con date pasada → 422 con `reason: "date_in_past"`.
- [ ] 4.3 (test integration) `POST` con date más allá del horizonte → 422 con `reason: "date_out_of_horizon"`.
- [ ] 4.4 (test integration) `POST` cuando otro user ya tiene la fecha → 409 `desk_already_booked`.
- [ ] 4.5 (test integration) `POST` cuando el mismo user ya tiene otra reserva ese día → 409 `user_already_booked_today`.
- [ ] 4.6 (test integration) `POST` sin auth → 401.
- [ ] 4.7 (test integration) `DELETE /api/desks/:id/bookings { date }` del propio user → 204.
- [ ] 4.8 (test integration) `DELETE` de la reserva de otro user → 403.
- [ ] 4.9 (test integration) `DELETE` por admin liberando reserva ajena daily → 204.
- [ ] 4.10 (test integration) `DELETE` de booking inexistente → 404.

## 5. Backend: extensión del detalle

- [ ] 5.1 (test integration) `GET /api/offices/:id?date=YYYY-MM-DD` incluye `bookings` del día.
- [ ] 5.2 (test integration) Sin `?date=` el endpoint asume hoy en UTC.
- [ ] 5.3 (test integration) Cada booking incluye `user: { id, name, avatar_url }` (la `avatar_url` proviene de Google y se persiste en el login).

## 6. Frontend

- [ ] 6.1 `state/office.ts` con bookings indexados por `${deskId}:${date}`.
- [ ] 6.2 `domain/desk-state.ts` exporta `deskState(desk, bookings, me, date)`.
- [ ] 6.3 (test unit FE) `deskState` devuelve los 4 valores según fixture.
- [ ] 6.4 `render/desk-renderer.ts` colorea según estado (libre/mine/occupied; fixed se añade en 008).
- [ ] 6.5 Click en desk libre abre modal "Reservar" con día actual.
- [ ] 6.6 Click en desk `mine` abre modal "Liberar".
- [ ] 6.7 Modal con confirm de "moverte" si ya tienes reserva ese día.
- [ ] 6.8 Tras 201/204, refrescar snapshot del día.
- [ ] 6.9 Tras 409, refrescar snapshot y mostrar toast del motivo.

## 7. E2E

- [ ] 7.1 (e2e) Alice reserva A1 hoy → al recargar sigue en cian.
- [ ] 7.2 (e2e) Bob entra y A1 aparece en rojo (ocupado por Alice).
- [ ] 7.3 (e2e) Alice libera A1 → al recargar A1 vuelve a verde.
- [ ] 7.4 (e2e) Alice reserva A1, intenta reservar A2 mismo día → confirm "Liberarás A1"; tras aceptar A1 verde, A2 cian.
- [ ] 7.5 (e2e) Bob intenta reservar A1 cuando Alice acaba de hacerlo (sin recargar) → toast "Ya estaba ocupado", snapshot refrescado.

## 8. Verificación

- [ ] 8.1 Coverage ≥ 80% en `bookings.ts`, `desk-state.ts`.
- [ ] 8.2 `pnpm test` y `pnpm e2e:chromium` en verde.
- [ ] 8.3 No hay `setTimeout` en frontend para "esperar" estado de booking; todo con responses y refetch.
