# Tasks

## 1. Backend: endpoints excepciones weekly

- [x] 1.1 Test integración: `POST /api/desks/:id/weekly/:weeklyId/exceptions { date }` con dueño de la weekly → 201.
- [x] 1.2 Test integración: caller no admin, weekly ajena → 403.
- [x] 1.3 Test integración: caller admin, weekly ajena → 201 + log `weekly.exception.created.byAdmin`.
- [x] 1.4 Test integración: `date` cuyo dow no coincide con `weekly.dow` → 422 `date_dow_mismatch`.
- [x] 1.5 Test integración: excepción duplicada → 409 `exception_already_exists`.
- [x] 1.6 Test integración: weeklyId que no pertenece al desk indicado → 404 `weekly_not_found`.
- [x] 1.7 Test integración: `DELETE /api/desks/:id/weekly/:weeklyId/exceptions { date }` con dueño → 204.
- [x] 1.8 Test integración: DELETE con admin → 204.
- [x] 1.9 Test integración: DELETE de excepción inexistente → 404 `exception_not_found`.
- [x] 1.10 Test unit: nuevo helper `deleteException(db, weeklyId, date)` en repo, devuelve true si borró, false si no.
- [x] 1.11 Implementar handlers en `weekly.ts` y helper en `weekly-assignments.ts`.

## 2. Frontend: modal de weekly

- [x] 2.1 Test unit: `mountWeeklyActionModal` modo `user_self` muestra "Saltarme hoy" + Cancelar.
- [x] 2.2 Test unit: `mountWeeklyActionModal` modo `user_self_with_exception` muestra "Recuperar mi puesto" + Cancelar.
- [x] 2.3 Test unit: `mountWeeklyActionModal` modo `admin` muestra los tres botones (saltar, quitar todos, cancelar).
- [x] 2.4 Test unit: ESC y click fuera cierran con `onClose`.
- [x] 2.5 Implementar `frontend/src/ui/weekly-action-modal.ts` (nuevo, no mezclar con admin-book-modal).

## 3. Wiring en OfficeScene

- [x] 3.1 Test unit: `handleDeskClick` con booking type `weekly` y user no admin propio abre el nuevo modal en modo `user_self`.
- [x] 3.2 Test unit: con admin pulsando weekly ajena abre modo `admin`.
- [x] 3.3 Test unit: con user no admin pulsando weekly de otro, sigue el flujo `showFeedback("Ocupado por X")` (sin modal).
- [x] 3.4 Implementar branch en `handleDeskClick` que detecta `booking.type === "weekly"` antes del flujo daily.
- [x] 3.5 Conectar callbacks del modal a `POST/DELETE` de exceptions y `DELETE` de weekly.

## 4. Validación final

- [x] 4.1 `openspec validate --all --strict` en verde.
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [x] 4.3 `pnpm test` en verde.
