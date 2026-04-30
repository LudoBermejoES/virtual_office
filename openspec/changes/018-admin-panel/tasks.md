# Tareas: Panel de administración

El ciclo TDD por tarea: escribe el test (red) → implementa lo mínimo (green) → refactoriza → marca [x].

## 1. Nuevos endpoints backend

### 1.1 GET /api/offices/:id/admins

- [x] 1.1.1 (test integration) `GET /api/offices/:id/admins` devuelve lista de admins — escribir el test primero.
- [x] 1.1.2 Implementar endpoint en `backend/src/http/routes/offices.ts` (solo admin de la oficina o super-admin).

### 1.2 GET /api/users y GET /api/users?email=

- [x] 1.2.1 (test integration) `GET /api/users` devuelve 200 con lista para admin y 403 para member — escribir el test primero.
- [x] 1.2.2 (test integration) `GET /api/users?email=` filtra por email — escribir el test primero.
- [x] 1.2.3 Crear `backend/src/http/routes/users.ts` con ambos endpoints (requireAdmin).
- [x] 1.2.4 Añadir `listUsers(db)` y `findUserByEmail(db, email)` a `backend/src/infra/repos/users.ts`.
- [x] 1.2.5 Registrar `usersRoutes` en `backend/src/http/server.ts`.

### 1.3 PATCH /api/users/:id (cambiar rol)

- [x] 1.3.1 (test integration) `PATCH /api/users/:id` con `{ role: "admin" }` promueve el usuario — escribir el test primero.
- [x] 1.3.2 (test integration) `PATCH /api/users/:id` devuelve 403 para no super-admin — escribir el test primero.
- [x] 1.3.3 Añadir endpoint PATCH en `users.ts` y `updateUserRole(db, id, role)` en repo.

### 1.4 POST /api/invitations/:id/renew

- [x] 1.4.1 (test integration) `POST /api/invitations/:id/renew` renueva invitación caducada — escribir el test primero.
- [x] 1.4.2 (test integration) `POST /api/invitations/:id/renew` renueva invitación aceptada — escribir el test primero.
- [x] 1.4.3 (test integration) `POST /api/invitations/:id/renew` devuelve 403 para member — escribir el test primero.
- [x] 1.4.4 Añadir endpoint en `backend/src/http/routes/invitations.ts` y lógica `renewInvitation` en repo.

### 1.5 GET /api/offices/:id/fixed-assignments

- [x] 1.5.1 (test integration) `GET /api/offices/:id/fixed-assignments` devuelve asignaciones con datos de puesto y usuario — escribir el test primero.
- [x] 1.5.2 Implementar endpoint en `offices.ts` y consulta con JOIN en `backend/src/infra/repos/fixed-assignments.ts`.

## 2. Frontend — AdminPanel overlay

### 2.1 Botón ⚙ en HUDScene

- [x] 2.1.1 (test unit) `HUDScene` monta botón ⚙ cuando `meRole="admin"` y no lo monta para `"member"` — escribir el test primero.
- [x] 2.1.2 Añadir lógica en `frontend/src/scenes/HUDScene.ts` para montar/destruir el botón según el rol.

### 2.2 Componente AdminPanel base

- [x] 2.2.1 Crear `frontend/src/ui/admin-panel.ts` con `mountAdminPanel()` / `unmountAdminPanel()`.
- [x] 2.2.2 Overlay con header, pestañas (OFICINAS | USUARIOS | FIJOS) y botón ✕.
- [x] 2.2.3 Navegación entre pestañas (clic cambia sección visible).

### 2.3 Pestaña Oficinas

- [x] 2.3.1 Cargar y mostrar lista de oficinas con `GET /api/offices`.
- [x] 2.3.2 Formulario de creación: nombre + upload TMJ/tilesets → `POST /api/offices`.
- [x] 2.3.3 Edición inline de nombre → `PATCH /api/offices/:id`.
- [x] 2.3.4 Botón eliminar con confirmación → `DELETE /api/offices/:id`.
- [x] 2.3.5 Botón "Editar puestos" → cierra panel, inicia `AdminMapScene`.
- [x] 2.3.6 Sub-panel office-admins: lista (`GET /api/offices/:id/admins`).

### 2.4 Pestaña Usuarios e Invitaciones

- [x] 2.4.1 Cargar y mostrar lista de usuarios con `GET /api/users`.
- [x] 2.4.2 Botones promover/degradar → `PATCH /api/users/:id`.
- [x] 2.4.3 Cargar y mostrar lista de invitaciones con `GET /api/invitations?include=all`.
- [x] 2.4.4 Formulario crear invitación → `POST /api/invitations`.
- [x] 2.4.5 Botón revocar → `DELETE /api/invitations/:id`.
- [x] 2.4.6 Botón renovar → `POST /api/invitations/:id/renew`.

### 2.5 Pestaña Asignaciones Fijas

- [x] 2.5.1 Selector de oficina + carga de asignaciones → `GET /api/offices/:id/fixed-assignments`.
- [x] 2.5.2 Botón eliminar asignación → `DELETE /api/desks/:deskId/fixed`.

### 2.6 NoOfficeScene mejorada para admin

- [x] 2.6.1 Si `meRole="admin"`, mostrar botón "CREAR PRIMERA OFICINA" que abre el panel.
- [x] 2.6.2 `meRole` leído desde `officesStore` (ya seteado en `LoginScene`).

## 3. Verificación

- [x] 3.1 `pnpm test` (unit + integration) en verde.
- [x] 3.2 `pnpm e2e:chromium` en verde (10 tests nuevos; 3 fallos preexistentes no relacionados).
- [x] 3.3 `openspec validate --all --strict` en verde.
- [ ] 3.4 Prueba manual: admin puede crear oficina, invitar usuario, gestionar puestos desde el panel.
