## Context

`POST /api/desks/:id/bookings` y `DELETE /api/desks/:id/bookings` resuelven hoy el `user_id` del booking implícitamente desde la sesión (`request.user.id`). El admin no tiene forma de operar en nombre de otro.

Frontend: `OfficeScene.handleDeskClick` decide create/cancel según el estado del desk respecto al usuario actual (`meId`). No mira `meRole`, así que cualquier admin clickea su propia reserva como cualquier otro.

## Decisiones

### Decisión 1: Backend acepta `userId` opcional con guarda de admin

`POST /api/desks/:id/bookings`:
- Body: `{ date: string, userId?: number }`.
- Si `userId` presente y `request.user.role !== "admin"` → **403 forbidden**.
- Si `userId` presente y admin → comprobar que el usuario destino existe (`findUserById`); si no → **404 user_not_found**.
- `effectiveUserId = userId ?? request.user.id`.
- Resto de validaciones (ventana, fijo, conflicto) usan `effectiveUserId`.
- Si `userId === request.user.id` se comporta como sin `userId` (idempotente).

`DELETE /api/desks/:id/bookings`:
- Body: `{ date: string, userId?: number }` (hoy ya tiene `date`; añadimos `userId?`).
- Misma guarda: `userId` requiere admin, sino 403.
- Borra el booking de `effectiveUserId` para esa fecha en ese desk. Si no existe → 404.

**Por qué body en lugar de query string**: ya hay `date` en body en POST. Mantengo coherencia. DELETE-with-body es estándar y Fastify lo soporta sin problema.

### Decisión 2: Frontend — modal admin sustituye click directo

En `OfficeScene.handleDeskClick`, primer check:
```ts
if (officesStore.getState().meRole === "admin") {
  this.openAdminBookModal(desk);
  return;
}
// flujo actual de no-admin
```

El modal admin (`mountAdminBookModal({ desk, dateIso, onConfirm, onClose })`) se desmonta con ESC o click fuera. Renderiza dos modos:

- **Desk libre**: header "Reservar puesto X — fecha Y", input filtro, lista vertical de usuarios (admin "(yo)" arriba con badge, resto orden alfabético), botón "Reservar".
- **Desk ocupado**: header "Liberar puesto X — fecha Y", texto "Reservado por <name> (<email>)", botón rojo "Liberar reserva".

La lista se carga con `GET /api/users` (ya existe, requiere admin).

### Decisión 3: Reservas fijas y excepciones siguen como están

El modal **solo gestiona reservas diarias** del día actualmente seleccionado en `uiStore.selectedDate`. Si el desk tiene fijo asignado, el modal muestra "Asignado fijo a <user>" + botón disabled "Liberar (no aplicable a fijos)". Para gestionar fijos, el admin sigue yendo al admin panel. Es la única ruta de fijos.

### Decisión 4: WS broadcast

Las acciones admin deben emitir el mismo `desk.booked` / `desk.unbooked` que las acciones normales. El `request.user` del WS payload es el **usuario destino** (no el admin caller), porque eso es lo que ven los demás clientes — el desk lo ocupa quien lo ocupa, da igual quién hizo la reserva.

### Decisión 5: Anti-abuso y auditoría

Log explícito en `logger.info("booking.created.byAdmin", { adminId, targetUserId, deskId, date })` cuando admin reserva para otro. Útil para auditar quién hizo qué. Igual con `byAdmin` en delete.

## Risks / Trade-offs

- **Modal sobre el canvas Phaser**: el canvas captura clicks; el modal HTML overlay en `z-index: 10001` debería ganarle (igual que admin panel). Ya hay precedentes en el proyecto.
- **Lista de usuarios grande**: si la oficina tiene 200+ usuarios, scroll + filtro. La carga se hace al abrir el modal, no en el boot, así que no afecta al render del mapa.
- **Cache invalidation tras admin reserva**: el hub WS ya difunde `desk.booked` a todos los clientes de la oficina, incluido el del admin caller. La UI se autoactualiza.

## Migration Plan

1. Backend: schema body de POST/DELETE bookings acepta `userId?`. Tests integración.
2. Servicio admin con guarda. Logs de auditoría.
3. Frontend: modal admin (HTML overlay + tests unit con FakeDoc).
4. Frontend: branch admin en `OfficeScene.handleDeskClick`. Tests existentes de OfficeScene verifican que no-admin sigue igual.
5. E2E (opcional): admin reserva para otro y aparece booking del otro al recargar.
6. Validación final.
