# Tareas: Excepciones por día en puestos fijos

Ciclo TDD: test (red) → implementación (green) → refactor → marcar [x].

## 1. Migración SQL

- [x] 1.1 (test integration) Aplicar `0010_fixed_assignment_exceptions.sql` crea tabla con UNIQUE(fixed_assignment_id, date) y FK CASCADE — escribir test primero.
- [x] 1.2 Crear migración idempotente con `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`.

## 2. Repo `fixed-exceptions`

- [x] 2.1 (test unit) `createException(db, fixedId, date, byUserId)` inserta y retorna fila — escribir test primero.
- [x] 2.2 (test unit) `createException` con duplicado retorna fila existente sin error.
- [x] 2.3 (test unit) `deleteException(db, fixedId, date)` retorna `true` si borró, `false` si no existía.
- [x] 2.4 (test unit) `findException(db, fixedId, date)` retorna fila o null.
- [x] 2.5 (test unit) `listExceptionsByOfficeAndDate(db, officeId, date)` retorna excepciones para esa oficina y fecha.
- [x] 2.6 Implementar `backend/src/infra/repos/fixed-exceptions.ts` con esas funciones.

## 3. Endpoints REST

### 3.1 POST /api/desks/:deskId/fixed/skip

- [x] 3.1.1 (test integration) Titular del fijo crea excepción → 200 con `{exception}` — escribir test primero.
- [x] 3.1.2 (test integration) Admin crea excepción → 200.
- [x] 3.1.3 (test integration) Office-admin crea excepción → 200.
- [x] 3.1.4 (test integration) Member sin permisos → 403.
- [x] 3.1.5 (test integration) Fecha pasada → 400 `date_in_past`.
- [x] 3.1.6 (test integration) Fecha fuera del horizonte → 400 `date_out_of_horizon`.
- [x] 3.1.7 (test integration) Desk sin fijo → 404 `fixed_not_found`.
- [x] 3.1.8 (test integration) Idempotente: segunda llamada retorna mismo recurso.
- [x] 3.1.9 Implementar handler en `backend/src/http/routes/fixed-assignments.ts` o nuevo `fixed-exceptions.ts`.

### 3.2 DELETE /api/desks/:deskId/fixed/skip

- [x] 3.2.1 (test integration) Titular borra su excepción → 204 — escribir test primero.
- [x] 3.2.2 (test integration) Admin borra excepción de otro → 204.
- [x] 3.2.3 (test integration) Member → 403.
- [x] 3.2.4 (test integration) Excepción inexistente → 404 `not_found`.
- [x] 3.2.5 Implementar handler.

## 4. Snapshot omite fijos con excepción

- [x] 4.1 (test integration) `GET /api/offices/:id?date=X` con excepción para el fijo en X → no aparece booking — escribir test primero.
- [x] 4.2 (test integration) Sin excepción → fijo aparece (regresión).
- [x] 4.3 (test integration) Daily de otro usuario en el mismo desk con excepción → daily aparece, fijo no.
- [x] 4.4 (test integration) Excepción para X no afecta al snapshot de X+1.
- [x] 4.5 Modificar `routes/offices.ts` para excluir fijos con excepción.

## 5. WebSocket broadcast

- [x] 5.1 (test integration) POST skip emite `desk.fixed_skipped {deskId, userId, date}` por WS — escribir test primero.
- [x] 5.2 (test integration) DELETE skip emite `desk.fixed_unskipped`.
- [x] 5.3 Añadir `desk.fixed_skipped` y `desk.fixed_unskipped` a `WsServerMessage` en `packages/shared/src/ws.ts`.
- [x] 5.4 Implementar broadcast en los handlers.

## 6. Frontend: tipos compartidos

- [x] 6.1 Re-exportar tipos nuevos en `packages/shared/src/index.ts`.

## 7. Frontend: cliente HTTP

- [x] 7.1 Crear helper `frontend/src/voice/no.ts` — wait, no. Crear funciones en `frontend/src/api/fixed-exceptions.ts`: `skipFixedDay(deskId, date)`, `unskipFixedDay(deskId, date)`.

## 8. Frontend: handler de click en mi fijo

- [x] 8.1 (test unit) Si `state === "fixed"` y `userId === meId`, ofrecer confirm "¿Hoy no vienes?" — escribir test primero.
- [x] 8.2 (test unit) Confirm aceptado llama a POST `/api/desks/:id/fixed/skip` con la fecha actual seleccionada.
- [x] 8.3 (test unit) Tras éxito, dispara `refreshSnapshot`.
- [x] 8.4 Implementar en `OfficeScene.handleDeskClick`.

## 9. Frontend: handler de click en fijo de otro (admin)

- [x] 9.1 (test unit) Admin clica fijo ajeno → confirm "¿Marcar que [Fulano] hoy no viene?" → POST skip — escribir test primero.
- [x] 9.2 Implementar.

## 10. Frontend: deshacer excepción

- [x] 10.1 Backend: `GET /api/offices/:id?date=X` incluye campo opcional `myFixedExceptionToday: deskId` cuando el usuario tiene su fijo con excepción ese día.
- [x] 10.2 (test unit) Frontend: si recibo ese campo y clico en el desk indicado (que aparece como `free`), ofrecer "¿Vuelves hoy a tu puesto?" → DELETE skip.
- [x] 10.3 Implementar el campo en el snapshot y el handler.

## 11. Frontend: actualización por WS

- [x] 11.1 (test unit) Recibir `desk.fixed_skipped` con date === selectedDate dispara `refreshSnapshot`.
- [x] 11.2 (test unit) Recibir con date !== selectedDate no hace nada.
- [x] 11.3 Implementar en `OfficeScene.handleWsMessage`.

## 12. Logs Winston

- [x] 12.1 Añadir `logger.info("fixed.day_skipped", {...})` en POST.
- [x] 12.2 Añadir `logger.info("fixed.day_unskipped", {...})` en DELETE.

## 13. Verificación

- [x] 13.1 `pnpm test` (unit + integration) en verde.
- [x] 13.2 `openspec validate --all --strict` en verde.
- [x] 13.3 Prueba manual:
  - El dueño del fijo clica su puesto y elige "hoy no vengo" → desaparece.
  - Otro usuario reserva ese puesto como daily → aparece su avatar.
  - Al día siguiente, vuelve a aparecer el fijo del dueño.
  - El dueño deshace la excepción → vuelve a su puesto fijo.
  - Admin marca a otro como "no viene" → puesto liberado.
