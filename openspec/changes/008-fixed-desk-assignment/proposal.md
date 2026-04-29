# Propuesta: Fixed Desk Assignment

## Motivación

El usuario quiere que los administradores puedan colocar a alguien como "puesto fijo": un usuario tiene un desk asignado siempre, sin necesidad de reservarlo cada día. Visualmente debe distinguirse del booking diario y debe aparecer automáticamente en cualquier día consultado.

## Alcance

**En scope:**
- Tabla nueva `fixed_assignments(desk_id, user_id, created_at)` con `UNIQUE(desk_id)` y `UNIQUE(user_id)` (una persona, un desk fijo).
- Endpoint admin `POST /api/desks/:id/fixed { userId }`.
- Endpoint admin `DELETE /api/desks/:id/fixed`.
- Cuando se consulta `GET /api/offices/:id?date=...`, las assignments fijas se materializan virtualmente en el array `bookings` con `type: "fixed"`, salvo que para ese día exista ya una `daily` que la libere temporalmente.
- Las daily bookings tienen prioridad: un fixed puede ceder su puesto un día concreto si su titular lo libera; pero la liberación de un fixed se hace mediante un nuevo endpoint específico (no por `DELETE /api/desks/:id/bookings`).
- Estado visual `fixed` en el frontend: violeta con icono 📌.

**Fuera de scope:**
- Liberación temporal de un fixed para un día concreto (puede llegar en un change futuro).
- Múltiples desks fijos por usuario.
- Histórico de cambios en fixed (audit log).

## Dominios afectados

`reservas` (extiende el modelo y el endpoint `GET /api/offices/:id`).

## Orden y dependencias

Change `008`. Depende de `007-daily-desk-booking`.

## Impacto de seguridad

- Solo admins crean/eliminan fixed.
- UNIQUE constraint garantiza coherencia.
- El usuario fijo no puede liberar su propio fixed (debe pedírselo a un admin) — diseño deliberado.

## Rollback

`DELETE FROM fixed_assignments`. Las bookings daily persisten.
