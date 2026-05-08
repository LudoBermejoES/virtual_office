## Why

Hoy el flujo de reserva es uniforme: cualquier usuario, incluido el admin, al pulsar un puesto vacío en `OfficeScene` lo reserva para sí mismo, y al pulsar uno propio lo libera. Eso no cubre dos casos legítimos del admin:

1. **Reservar un puesto a otro usuario un día concreto** (ej. el admin recibe una petición por Slack: "¿me reservas el escritorio 12 para el viernes?").
2. **Liberar la reserva de otro usuario** (ej. alguien se ha ido de viaje y olvidó liberar; otra persona quiere ese sitio).

Hoy el admin solo puede:
- Crear reservas fijas (todos los días) vía admin panel.
- Crear excepciones a fijas (saltarse un día concreto de un fijo).
- Liberarse a sí mismo.

Lo que falta es la operación cotidiana: **reservar/liberar a otro usuario para un día concreto** desde la vista normal del mapa, donde el admin ya está mirando.

## What Changes

- **Backend** — `POST /api/desks/:id/bookings` acepta `userId` opcional en el body. Si está presente, el caller debe ser admin (de lo contrario 403). El usuario destino debe existir. La lógica de validación (ventana, fijos, conflicto) aplica al `userId` final usado.
- **Backend** — `DELETE /api/desks/:id/bookings` acepta también `userId` opcional con la misma semántica: si admin pasa `userId`, libera la reserva de ese usuario para la fecha indicada.
- **Frontend `OfficeScene`** — al detectar `meRole === "admin"`, el handler de click sobre un puesto NO ejecuta la acción directa; en su lugar abre un **modal** con:
  - Si el puesto está vacío: lista de usuarios visibles (admin arriba con etiqueta "(yo)", resto debajo) + filtro por nombre, y botón "Reservar".
  - Si el puesto está ocupado: mensaje "Reservado por <usuario> el <fecha>" + botón "Liberar reserva".
- **Frontend** — el flujo de usuarios no-admin sigue exactamente igual (click directo sobre vacío reserva, click sobre propio libera).

## Impact

- **Specs afectadas**:
  - `reservas` (cómo el admin reserva/libera para terceros).
  - `ui-game` (modal nuevo en `OfficeScene` para admin).
- **Código afectado**:
  - `backend/src/http/routes/bookings.ts` — body schema acepta `userId?`, validación de admin.
  - `backend/src/services/bookings.service.ts` (nuevo) o adaptación in-place — resolver `effectiveUserId`.
  - `frontend/src/scenes/OfficeScene.ts` — branch admin en `handleDeskClick`.
  - `frontend/src/ui/admin-book-modal.ts` (nuevo) — modal HTML overlay con lista + filtro.
  - Tests integración + unit + e2e (este último opcional).
- **Sin breaking changes**: el body sin `userId` se comporta como hoy. La UI de no-admin no cambia.
- **Sin nuevas dependencias**.
