# Propuesta: Day Navigation

## Motivación

El usuario quiere navegar entre días para ver los puestos asignados a cada fecha. El backend ya soporta `?date=` en `GET /api/offices/:id` desde `007`. Este change añade la UI de navegación, los atajos y la lógica de fecha en cliente.

## Alcance

**En scope:**
- Botones `<` y `>` en `HUDScene` que avanzan/retroceden un día.
- Atajos teclado `←`/`→` (configurables).
- Etiqueta central con la fecha en formato legible localizado al castellano: "jueves 7 de mayo de 2026".
- Botón "Hoy" para volver al día actual.
- Mantener la WebSocket abierta al cambiar de día; solo refetch del snapshot.
- Persistencia del último día visitado en `sessionStorage` (no localStorage para que un nuevo día siempre arranque en hoy).
- Validación cliente-side: no permitir avanzar más allá del horizonte ni retroceder más allá del límite (configurable, default 30 días atrás).

**Fuera de scope:**
- Calendar picker / vista mensual (futuro).
- Mostrar varios días simultáneamente (futuro).
- Edición de bookings de días pasados.

## Dominios afectados

`reservas` (UI). Sin cambios en backend.

## Orden y dependencias

Change `010`. Depende de `007-daily-desk-booking`.

## Impacto de seguridad

Ninguno. La validación de "fecha permitida" la hace el backend en cada operación.

## Rollback

Trivial: quitar HUD de navegación; el endpoint sigue sirviendo cualquier `date`.
