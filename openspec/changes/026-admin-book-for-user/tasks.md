# Tasks

## 1. Backend: aceptar `userId` en bookings (POST/DELETE)

- [ ] 1.1 Test integración: `POST /api/desks/:id/bookings` con `userId` y caller admin reserva para ese usuario; respuesta 201 con `booking.user_id` correcto.
- [ ] 1.2 Test integración: `POST` con `userId` y caller no-admin → 403 `forbidden`.
- [ ] 1.3 Test integración: `POST` con `userId` que no existe → 404 `user_not_found`.
- [ ] 1.4 Test integración: `POST` con `userId === request.user.id` se comporta igual que sin `userId` (idempotente).
- [ ] 1.5 Test integración: validaciones de fecha, ventana, fijo conflictivo, doble reserva — siguen funcionando con `userId` admin.
- [ ] 1.6 Test integración: WS difunde `desk.booked` con el **usuario destino**, no con el admin caller.
- [ ] 1.7 Test integración: `DELETE /api/desks/:id/bookings` con `userId` y caller admin libera la reserva del otro usuario.
- [ ] 1.8 Test integración: `DELETE` con `userId` y caller no-admin → 403.
- [ ] 1.9 Adaptar handlers en `bookings.ts` con schema Zod `{ date, userId? }`, guarda admin, resolución `effectiveUserId`, log `byAdmin`.

## 2. Frontend: modal admin para reservar/liberar

- [ ] 2.1 Test unit: `mountAdminBookModal` renderiza header con desk.label + fecha formateada.
- [ ] 2.2 Test unit: en desk libre, lista usuarios con admin (yo) arriba; click sobre uno + botón "Reservar" llama `onConfirm({ deskId, userId })`.
- [ ] 2.3 Test unit: en desk ocupado, muestra "Reservado por <name>" y botón "Liberar" llama `onConfirm({ deskId, userId, action: "release" })`.
- [ ] 2.4 Test unit: filtro por nombre/email reduce la lista en tiempo real.
- [ ] 2.5 Test unit: ESC y click fuera desmontan el modal con `onClose`.
- [ ] 2.6 Implementar `frontend/src/ui/admin-book-modal.ts`.

## 3. Frontend: integración con OfficeScene

- [ ] 3.1 Test unit: `handleDeskClick` con `meRole === "admin"` abre el modal en lugar de reservar/liberar directamente.
- [ ] 3.2 Test unit: con `meRole === "member"` el flujo actual no cambia.
- [ ] 3.3 Implementar el branch admin: cargar usuarios vía `GET /api/users`, montar modal, en `onConfirm` llamar al endpoint correspondiente (POST o DELETE) con `userId`.
- [ ] 3.4 Manejar errores de red en el modal (mostrar mensaje, no cerrar).

## 4. Validación final

- [ ] 4.1 `openspec validate --all --strict` en verde.
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [ ] 4.3 `pnpm test` en verde (backend + frontend + tools).
