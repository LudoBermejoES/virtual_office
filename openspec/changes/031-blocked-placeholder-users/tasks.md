# Tasks

## 1. Migración + repo

- [x] 1.1 Test integración: la migración `0010_placeholder_users.sql` añade `is_placeholder` con `DEFAULT 0` y siembra exactamente tres filas con `name` `Bloqueado #1..#3` y `google_sub` `placeholder:1..3`.
- [x] 1.2 Test integración: usuarios reales preexistentes quedan con `is_placeholder = 0` tras migrar.
- [x] 1.3 Test integración: re-ejecutar el `INSERT OR IGNORE` del seed no duplica filas ni lanza error de unicidad.
- [x] 1.4 Test unit: `listUsers(db)` excluye los placeholders.
- [x] 1.5 Test unit: `listUsers(db, { includePlaceholders: true })` los devuelve al final del array.
- [x] 1.6 Test unit: `findUserByEmail(db, "bloqueado1@teimas.space")` devuelve la fila con `is_placeholder = 1`.
- [x] 1.7 Test unit: `isPlaceholder(user)` devuelve `true` solo con `is_placeholder = 1`.
- [x] 1.8 Implementar `backend/src/infra/db/migrations/0010_placeholder_users.sql` (columna + seed + índice parcial).
- [x] 1.9 Implementar el flag `includePlaceholders` en `listUsers` y el helper `isPlaceholder` en `backend/src/infra/repos/users.ts`.
- [x] 1.10 Añadir `is_placeholder: number` a `UserRow`.
- [x] 1.11 Test unit: el orden de los placeholders es estable aunque compartan `created_at` (desempate por `id`).
- [x] 1.12 Retirar `listPlaceholders`: código muerto (nadie lo llamaba) y ordenaba `google_sub` lexicográficamente.

## 2. Login: los placeholders no entran

- [x] 2.1 Test integración: login cuyo email coincide con un placeholder y cuyo dominio está en `TEIMAS_DOMAINS` → 403 `placeholder_cannot_login`, sin `Set-Cookie`.
- [x] 2.2 Test integración: ese mismo intento no modifica la fila del placeholder.
- [x] 2.3 Test integración: login de un empleado real con `sub` numérico de Google → 200, y las tres filas de placeholder quedan intactas.
- [x] 2.4 Test integración: login con email `bloqueado1@teimas.space` y `TEIMAS_DOMAINS` real (sin `teimas.space`) → 403, sin sesión.
- [x] 2.5 Test unit: el log `auth.rejected` con `reason: "placeholder_cannot_login"` no incluye el email completo.
- [x] 2.6 Implementar el rechazo en `backend/src/http/routes/auth.ts`, tras resolver el usuario y antes de firmar el JWT.

## 3. Endpoints: gestión y visibilidad

- [x] 3.1 Test integración: `GET /api/users` (admin) con dos usuarios reales + tres placeholders → 200 con solo los dos reales.
- [x] 3.2 Test integración: `GET /api/users?includePlaceholders=1` → 200 con cinco elementos, placeholders al final, cada uno con `is_placeholder: 1`.
- [x] 3.3 Test integración: `GET /api/users?email=bloqueado1@teimas.space` → 200 con el placeholder.
- [x] 3.4 Test integración: `GET /api/users?includePlaceholders=1` como member → 403.
- [x] 3.5 Test integración: `PATCH /api/users/<idPlaceholder>` con `{ role: "admin" }` → 409 `cannot_modify_placeholder`, rol sin cambiar.
- [x] 3.6 Test integración: `POST /api/invitations { email: "bloqueado1@teimas.space" }` → 422 `cannot_invite_placeholder`, sin fila en `invitations`.
- [x] 3.7 Test integración: `POST /api/users/<idPlaceholder>/avatar` con PNG válido → 200, `avatar_locked = 1` (regresión del change 030 sobre placeholders).
- [x] 3.8 Implementar la query `includePlaceholders` en `GET /api/users`.
- [x] 3.9 Implementar el guard de `PATCH /api/users/:id`.
- [x] 3.10 Implementar el guard de `POST /api/invitations`.
- [x] 3.11 Test integración: `PATCH /api/users/<idInexistente>` → 404 `user_not_found` (antes devolvía 200 sin tocar nada).
- [x] 3.12 Test integración: `GET /api/users?includePlaceholders=1&date=D` anota `has_daily_booking: 1` en un placeholder con daily en OTRA oficina.
- [x] 3.13 Test integración: una reserva `fixed` ese día deja `has_daily_booking: 0`.
- [x] 3.14 Test integración: sin `date` no aparece la clave `has_daily_booking`; con fecha malformada → 400.
- [x] 3.15 Implementar el parámetro `date` en `GET /api/users` y `listDailyBookedUserIds` en el repo de bookings.
- [x] 3.16 Implementar el 404 de `PATCH /api/users/:id`.

## 4. Reservas: bloquear con los flujos existentes

- [x] 4.1 Test integración: admin `POST /api/desks/:id/bookings { date, userId: placeholder1 }` → 201 con `type: "daily"` y log `booking.created.byAdmin`.
- [ ] 4.2 Test integración: ese POST difunde `desk.booked` por WS con el usuario `Bloqueado #1`. **Pendiente**: el broadcast es código compartido sin ramas por placeholder (`bookings.ts` emite el `user` destino sin mirar `is_placeholder`), así que no se añadió test propio.
- [x] 4.3 Test integración: admin `DELETE /api/desks/:id/bookings { date, userId: placeholder1 }` → 204. (El `desk.released` por WS no se asserta: mismo motivo que 4.2.)
- [x] 4.4 Test integración: bloquear A1/A2/A3 el mismo día con los tres placeholders → tres 201, y `GET /api/offices/:id?date=D` devuelve los tres ocupados.
- [x] 4.5 Test integración: cuarto bloqueo reutilizando `Bloqueado #1` el mismo día → 409 `user_already_booked_today`, sin fila nueva.
- [x] 4.6 Test integración: `Bloqueado #1` en A1 el día `D` y en A2 el día `D+1` → ambas 201 y coexisten.
- [x] 4.7 Test integración: `POST /api/desks/:id/fixed { userId: placeholder2 }` → 201 y el detalle de la oficina lo muestra con `type: "fixed"`.
- [x] 4.8 Test integración: `POST /api/desks/:id/weekly { userId: placeholder3, dow: 0 }` → 201 y un lunes lo muestra con `type: "weekly"`.
- [x] 4.9 Test integración: segundo weekly de `Bloqueado #1` con el mismo `dow` en otro desk → 409 `user_dow_conflict`.
- [x] 4.10 Test integración: excepción sobre el weekly de un placeholder → 201 y ese lunes el puesto sale libre.
- [x] 4.11 Test integración: member enviando `userId` de placeholder → 403 `forbidden`, sin reserva.
- [x] 4.12 Test integración: bloqueo con fecha en el pasado → 422 `date_in_past`.
- [x] 4.13 Test integración: usuario real intentando reservar un puesto bloqueado → 409 `desk_already_booked`.
- [x] 4.14 Test integración: `GET /api/offices/:id?date=D` proyecta el bloqueo como `{ type: "daily", user: { name: "Bloqueado #1" } }` sin campos extra.
- [x] 4.15 Test integración: daily de Alice prevalece sobre weekly de `Bloqueado #1` en el mismo desk y día.
- [x] 4.16 Verificar que nada de lo anterior requirió cambios en rutas de bookings, fixed o weekly; si alguno falla, corregir sin tocar índices ni precedencia.

## 5. Frontend: modal de reserva

- [x] 5.1 Test unit: `mountAdminBookModal` en modo `book` renderiza los placeholders al final, bajo un separador `BLOQUEAR PUESTO`.
- [x] 5.2 Test unit: seleccionar `Bloqueado #1` y pulsar `Guardar` invoca `onConfirmBook` con su `userId`.
- [x] 5.3 Test unit: filtrar por `bloq` muestra los tres placeholders y oculta los usuarios reales que no coinciden.
- [x] 5.4 Test unit: un placeholder con `usedToday` renderiza su fila deshabilitada, no seleccionable, con `title` explicativo.
- [x] 5.5 Test unit: los otros dos placeholders siguen seleccionables en ese caso.
- [x] 5.6 Test unit: con los tres agotados, el separador muestra `sin bloqueos libres este día`.
- [x] 5.7 Test unit: marcar el checkbox `L` de un placeholder produce `weeklyChanges.create` con `{ userId, dow: 0 }`.
- [x] 5.8 Implementar en `frontend/src/ui/admin-book-modal.ts`: separador, orden, y campos `isPlaceholder` / `usedToday` en `AdminBookModalUser`.
- [x] 5.9 Adaptar `OfficeScene.ts:592` para pedir `?includePlaceholders=1&date=<fecha activa>` y calcular `usedToday` con el `has_daily_booking` del backend. El snapshot local solo conoce la oficina activa y no distingue `daily` de `fixed`, así que calcularlo en el cliente dejaba pasar el 409 al cambiar de oficina y bloqueaba placeholders con puesto fijo.

## 6. Frontend: render y admin panel

- [x] 6.1 Test unit: `deskState` con booking de placeholder y `meId` distinto → `"occupied"`.
- [x] 6.2 Test unit: `deskState` con fijo de placeholder → `"fixed"`.
- [ ] 6.3 Test unit: la etiqueta del ocupante muestra `Bloqueado #1` y usa su `avatar_url` cuando existe. **Pendiente**: cubierto indirectamente (el backend ya devuelve `user.name`/`avatar_url` del placeholder y el renderer no distingue), pero sin test unit dedicado.
- [x] 6.4 Test unit: la pestaña `USUARIOS` renderiza los placeholders bajo `PUESTOS BLOQUEADOS`, con botón `Avatar` y sin `Promover`/`Degradar`.
- [ ] 6.5 Test unit: la sección `INVITACIONES` no incluye ninguna fila de email de placeholder. **Pendiente**: garantizado por el backend (un placeholder nunca llega a `invitations`, ver test 3.6); `renderUsuarios` no es testeable sin refactor de inyección de doc.
- [x] 6.6 Implementar la sección `PUESTOS BLOQUEADOS` en `frontend/src/ui/admin-panel.ts` (pestaña USUARIOS pidiendo `?includePlaceholders=1`).
- [x] 6.7 Verificar que la pestaña `FIJOS` sigue ofreciendo los placeholders como destino (ya usa `api/users`; añadir `?includePlaceholders=1`).

## 7. E2E

- [x] 7.1 Test e2e: admin bloquea un puesto con `Bloqueado #1` y el detalle lo devuelve ocupado con ese nombre. (A nivel de API: el mapa es un canvas Phaser no consultable, misma convención que el resto de `flows/`.)
- [x] 7.2 Test e2e: el admin desbloquea el puesto y vuelve a salir libre en el detalle.
- [x] 7.3 Test e2e: un member ve el puesto ocupado por `Bloqueado #1`, recibe 409 al reservarlo y 403 al intentar bloquear.

## 8. Cierre

- [x] 8.1 `openspec validate --all --strict` en verde.
- [x] 8.2 `pnpm typecheck` en verde.
- [x] 8.3 `pnpm lint && pnpm format:check` en verde.
- [x] 8.4 `pnpm test` (unit + integration) en verde.
- [x] 8.5 `pnpm e2e:chromium` en verde.
- [x] 8.6 Documentar en `doc/be/README.md` el concepto de usuario placeholder y el límite de tres bloqueos simultáneos por día.
