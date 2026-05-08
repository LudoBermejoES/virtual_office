## Why

El change 027 introdujo `weekly_assignments` (Ana viene los lunes y miércoles) y dejó la tabla `weekly_assignment_exceptions` creada pero sin API pública. Ahora aparecen tres casos reales de uso que no tenemos cubiertos:

1. **Usuario quiere saltarse un día concreto de su weekly**: "este miércoles no voy". Hoy no puede; o le sigue ocupando el desk en la vista de los demás (lo que confunde) o tiene que pedirle a un admin que le borre la weekly entera (demasiado).
2. **Admin quiere saltar un día concreto de la weekly de otra persona**: "Ana no viene este lunes, libera el desk para que lo coja Bob". Mismo problema.
3. **Admin quiere borrar la weekly entera al pulsar el desk** (cambio definitivo): hoy lo puede hacer desde el modal book con los checkboxes, pero al pulsar directamente sobre un puesto ocupado por weekly el flujo da 404 (`bookings.findBy` no encuentra el booking porque es proyectado).

Adicionalmente, este último problema es un **bug real introducido por el 027 ya en producción**: el modal release del change 026 llama `DELETE /api/desks/:id/bookings` que solo conoce daily bookings y devuelve 404 cuando el booking proyectado es weekly.

## What Changes

- **Backend** — Nuevo endpoint `POST /api/desks/:id/weekly/:weeklyId/exceptions` con body `{ date }`. Crea una `weekly_assignment_exception` que invalida la weekly para esa fecha concreta.
  - Guarda: el caller debe ser **el dueño de la weekly** (`weekly.user_id === me.id`) o **admin de la oficina**.
  - Validaciones: `date` válida, dow de la fecha coincide con el `weekly.dow` (la excepción solo aplica al día semanal correspondiente, no a fechas arbitrarias), no hay excepción duplicada.
- **Backend** — `DELETE /api/desks/:id/weekly/:weeklyId/exceptions { date }` para deshacer una excepción ("vuelvo a venir este miércoles después de todo").
- **Frontend** — Cuando un user (no admin) pulsa el desk donde tiene su weekly hoy: nuevo modal "Saltarme hoy / Cancelar".
- **Frontend** — Cuando un admin pulsa un desk ocupado por weekly de cualquier usuario: nuevo modal con tres acciones: "Saltar este día" (crea exception), "Quitar todos los <día>" (borra la weekly entera con confirm), "Cancelar".
- **Frontend** — Si un user pulsa un desk ocupado por su weekly **y ya tiene exception activa para ese día** ("ya me había saltado, vuelvo"), opción "Recuperar mi puesto" (DELETE exception).
- **Bug fix del 027**: el modal release del 026 ya no se invoca para bookings proyectados; éstos abren el modal nuevo de weekly.

## Impact

- **Specs afectadas**:
  - `reservas` (nuevos endpoints, validaciones, scenario "user crea exception", "admin crea exception", "exception suprime el booking proyectado").
  - `ui-game` (modales nuevos para user y admin sobre weekly).
- **Código nuevo**:
  - 2 endpoints en `backend/src/http/routes/weekly.ts` (POST/DELETE exceptions).
  - 2 funciones en `backend/src/infra/repos/weekly-assignments.ts` (`deleteException`).
  - 1 modal nuevo en `frontend/src/ui/` o reutilización del actual con un `kind` adicional.
  - Adaptación de `OfficeScene.handleDeskClick` para detectar `booking.type === "weekly"` y enrutar a la nueva UI en lugar del modal release del 026.
- **Sin breaking changes** salvo el flujo (correcto) de que liberar weekly ya no usa `DELETE /bookings`. Los flujos de daily/fixed siguen igual.
- **Sin nuevas dependencias**.

## Notas

- La tabla `weekly_assignment_exceptions` y la columna `dow` ya existen desde la migración 0008 (change 027). NO hace falta migración nueva.
- Convención: `dow` 0..6 con ISO 8601 (lunes=0). Helper `dowOfDate` en `@virtual-office/shared`.
