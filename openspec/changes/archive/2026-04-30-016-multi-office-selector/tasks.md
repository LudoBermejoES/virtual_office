# Tareas: selector multi-oficina

El ciclo TDD por tarea: escribe el test (red) → implementa lo mínimo (green) → refactoriza → marca [x].

## 1. Migración DB

- [x] 1.1 (test integration) Migración `0006_multi_office.sql` aplica de forma idempotente sobre DB ya poblada — escribir el test primero.
- [x] 1.2 Crear `0006_multi_office.sql`: añade `users.default_office_id` y crea `office_admins`.
- [x] 1.3 Tipos compartidos en `packages/shared/src/office.ts`: `OfficeSummary { id, name, is_admin, is_default }`.

## 2. Helper de autorización

- [x] 2.1 (test unit) `canAdminOffice`: usuario con `is_admin=1` global devuelve `true` para cualquier oficina — escribir el test primero.
- [x] 2.2 (test unit) `canAdminOffice`: usuario en `office_admins` para oficina X devuelve `true` para X y `false` para Y — escribir el test primero.
- [x] 2.3 (test unit) `canAdminOffice`: usuario member sin entrada en `office_admins` devuelve `false` — escribir el test primero.
- [x] 2.4 (test integration) Usuario office-admin de oficina 1 puede subir mapa a la 1 pero recibe 403 al intentarlo en la 2 — escribir el test primero.
- [x] 2.5 Crear `backend/src/services/auth.service.ts` con `canAdminOffice(user, officeId, db)`.
- [x] 2.6 Aplicar el helper a: subir mapa, crear/borrar desks, fixed-assignments, invitaciones.

## 3. Endpoints

- [x] 3.1 (test integration) `GET /api/offices` incluye `is_admin` y `is_default` por oficina para el usuario autenticado — escribir el test primero.
- [x] 3.2 (test integration) `PATCH /api/me { default_office_id }` persiste la preferencia y se refleja en el siguiente `/api/me` — escribir el test primero.
- [x] 3.3 (test integration) `POST /api/offices/:id/admins` con super-admin crea la entrada; con office-admin devuelve 403 — escribir el test primero.
- [x] 3.4 (test integration) `DELETE /api/offices/:id/admins/:userId` elimina el office-admin; solo super-admin puede hacerlo — escribir el test primero.
- [x] 3.5 Extender `GET /api/offices` con `is_admin` y `is_default` por fila.
- [x] 3.6 Implementar `PATCH /api/me { default_office_id }`.
- [x] 3.7 Implementar `POST /api/offices/:id/admins { user_id }` (solo super-admin).
- [x] 3.8 Implementar `DELETE /api/offices/:id/admins/:userId` (solo super-admin).

## 4. Frontend — selector

- [x] 4.1 (test unit FE) `mountOfficeSelector` muestra la oficina actual y dispara `onChange` con id correcto al click — escribir el test primero.
- [x] 4.2 (test unit FE) `mountOfficeSelector` con una sola oficina no muestra el selector (o lo muestra deshabilitado) — escribir el test primero.
- [x] 4.3 Crear `frontend/src/ui/office-selector.ts` con `mountOfficeSelector(parent, current, offices, onChange)`.
- [x] 4.4 CSS de selector en `style.css` con paleta arcade.
- [x] 4.5 Integrar en HUD: top-left, debajo del logo si lo hubiera.
- [x] 4.6 Click → cambia escena con la nueva oficina; cierra WS anterior y abre el nuevo room.
- [x] 4.7 Persistir id en `localStorage["vo_last_office"]`.

## 5. Lógica de selección al login

- [x] 5.1 (test e2e) Usuario sin `default_office_id` y con dos oficinas va a la primera — escribir el test primero.
- [x] 5.2 (test e2e) Usuario con `default_office_id=2` va directamente a la 2 — escribir el test primero.
- [x] 5.3 (test e2e) Usuario sin ninguna oficina visible ve la pantalla "sin oficina" — escribir el test primero.
- [x] 5.4 En `LoginScene.handleCredential`: tras autenticar, fetch `/api/me` y `/api/offices`.
- [x] 5.5 Aplicar la prioridad: server default → localStorage → primera admin → primera visible → "sin oficina".
- [x] 5.6 Pantalla "sin oficina" muestra mensaje "Aún no hay oficinas. Pide a un admin que cree una".

## 6. Bootstrap

- [x] 6.1 Script `backend/scripts/bootstrap-admin.ts` que crea/promociona un usuario a super-admin por email.
- [x] 6.2 Documentar en `README.md` cómo correrlo.
- [x] 6.3 Tarea separada en `package.json`: `pnpm bootstrap:admin <email>`.

## 7. Verificación

- [x] 7.1 `pnpm test` (unit + integration) en verde.
- [x] 7.2 `pnpm e2e:chromium` en verde con flujo completo "login → selector → cambiar a otra oficina → reservar".
- [ ] 7.3 Inspección manual: 2 oficinas, cambiar entre ambas, ver bookings independientes.
- [x] 7.4 `openspec validate --all --strict` en verde.
