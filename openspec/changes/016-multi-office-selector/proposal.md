# Propuesta: Selector de oficina y permisos por oficina

## Motivación

Teimas tiene presencia en varias localizaciones (Compostela, Madrid, etc.). El esquema ya tiene `offices` como tabla 1:N pero **el frontend asume una sola oficina**: la primera que devuelve `GET /api/offices`. No hay UI para listarlas, ni para cambiar entre ellas, ni para asignar usuarios a una oficina por defecto. El admin tampoco puede gestionar per-office (todo admin es admin global).

## Alcance

**En scope:**

### A. Selector de oficina en HUD
- `GET /api/offices` ya devuelve la lista; el frontend la consume y muestra un dropdown HTML overlay en el HUD (esquina superior izquierda) con el nombre de la oficina actual.
- Click → menú con todas las oficinas a las que el usuario tiene acceso.
- Cambio: navega a `OfficeScene` con la nueva `officeId`, persistencia en `localStorage` (clave `vo_last_office`).

### B. Oficina por defecto del usuario
- Migración: añadir `users.default_office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL`.
- Endpoint `PATCH /api/me { default_office_id }` para que cada usuario fije su oficina principal.
- Al login, si `users.default_office_id` está set, se redirige ahí; si no, a la primera oficina visible o, si no hay ninguna, a una pantalla "sin oficina".

### C. Permisos por oficina
- Migración: tabla `office_admins (office_id, user_id, PRIMARY KEY(office_id, user_id))`.
- `is_admin` a nivel global se mantiene (super-admin), pero las acciones de admin sobre una oficina concreta (subir mapa, marcar fijos, gestionar invitaciones) MUST también permitirse a `office_admins` de esa oficina.
- Endpoints `POST/DELETE /api/offices/:id/admins/:userId` solo accesibles por super-admin.

### D. Seed de oficina por defecto
- Cuando se crea el primer usuario admin (bootstrap), se le asigna `default_office_id` a la primera oficina existente. Si no hay oficinas, queda null.

**Fuera de scope:**
- Sincronización cross-office (un usuario reserva en CSC y aparece en Madrid — eso no aplica).
- Bookings cross-office (un usuario solo reserva en una oficina por día — restricción aplica por oficina, no global).

## Dominios afectados

`oficinas`, `autenticacion` (estado de sesión + claim).

## Orden y dependencias

Change `016`. Depende de `005` (crear oficinas) y `003` (auth).

## Impacto de seguridad

- Aislamiento: `GET /api/offices/:id` MUST 403 si el usuario no tiene acceso a esa oficina (modelo: por ahora todo usuario autenticado ve todas las oficinas — sigue así, pero el spec deja la puerta abierta para futura restricción).
- `office_admins`: solo super-admin puede modificar.

## Rollback

- Borrar columna `users.default_office_id` (DEFAULT NULL, no rompe).
- `office_admins` table: drop si nadie la consume.
- Quitar UI selector — el sistema vuelve a usar la primera oficina.
