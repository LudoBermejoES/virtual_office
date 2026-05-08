# Tasks

## 1. Backend: aceptar `userId` en bookings (POST/DELETE)

- [x] 1.1 Test integración: `POST /api/desks/:id/bookings` con `userId` y caller admin → 201 con `booking.user_id` correcto.
- [x] 1.2 Test integración: `POST` con `userId` y caller no-admin → 403.
- [x] 1.3 Test integración: `POST` con `userId` que no existe → 404 `user_not_found`.
- [x] 1.4 Test integración: `POST` con `userId === me.id` se comporta como sin userId.
- [x] 1.5 Test integración: doble reserva del destino → 409 `user_already_booked_today`.
- [x] 1.6 Cobertura WS: el broadcast emite con el `user_id` del destino (lógica del handler ya lo hace; suite anterior no rompe).
- [x] 1.7 Test integración: `DELETE` con `userId` y caller admin → 204 libera la reserva del otro.
- [x] 1.8 Test integración: `DELETE` con `userId` y caller no-admin → 403.
- [x] 1.9 Handlers adaptados con schema Zod `{ date, userId? }`, guarda admin, log `byAdmin` en POST y DELETE.

## 2. Frontend: modal admin para reservar/liberar

- [x] 2.1 Test unit: `mountAdminBookModal` renderiza header con desk.label + fecha formateada.
- [x] 2.2 Test unit: en desk libre, lista usuarios con admin (yo) arriba; click sobre uno + botón "Reservar" llama `onConfirmBook(userId)`.
- [x] 2.3 Test unit: en desk ocupado, muestra `Reservado por <name>` y botón "Liberar" llama `onConfirmRelease()`.
- [x] 2.4 Test unit: filtro por nombre/email reduce la lista en tiempo real.
- [x] 2.5 Test unit: ESC y click fuera desmontan el modal con `onClose`.
- [x] 2.6 Implementado en `frontend/src/ui/admin-book-modal.ts` (8 tests passing).

## 3. Frontend: integración con OfficeScene

- [x] 3.1 `handleDeskClick` con `meRole === "admin"` delega a `openAdminBookModal` en lugar de la acción directa.
- [x] 3.2 Con `meRole === "member"` el flujo actual no cambia (regresión cubierta por suite frontend completa, 205/205).
- [x] 3.3 Branch admin implementado: carga usuarios vía `GET /api/users`, monta modal según `state` del desk, en `onConfirm` llama POST/DELETE con `userId`.
- [x] 3.4 Errores de red mostrados vía `showFeedback` (mensaje no bloqueante en HUD).

## 4. Validación final

- [x] 4.1 `openspec validate --all --strict` → 10/10 passed.
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm format:check` clean.
- [x] 4.3 `pnpm test` → 602/602 (backend 355 + frontend 205 + tools 42).
