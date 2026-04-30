# Tareas: selector multi-oficina

## 1. Migración DB

- [ ] 1.1 Crear `0006_multi_office.sql`: añade `users.default_office_id` y crea `office_admins`.
- [ ] 1.2 (test integration) Migración aplica de forma idempotente sobre DB ya poblada.
- [ ] 1.3 Tipos compartidos en `packages/shared/src/office.ts`: `OfficeSummary { id, name, is_admin, is_default }`.

## 2. Helper de autorización

- [ ] 2.1 Crear `backend/src/services/auth.service.ts` con `canAdminOffice(user, officeId, db)`.
- [ ] 2.2 (test unit) `is_admin=1` global devuelve true para cualquier oficina.
- [ ] 2.3 (test unit) Usuario en `office_admins` para oficina X devuelve true para X y false para Y.
- [ ] 2.4 Aplicar el helper a: subir mapa, crear/borrar desks, fixed-assignments, invitaciones.
- [ ] 2.5 (test integration) Usuario office-admin de oficina 1 puede subir mapa a la 1 pero recibe 403 al intentarlo en la 2.

## 3. Endpoints

- [ ] 3.1 Extender `GET /api/offices` con `is_admin` y `is_default` por fila.
- [ ] 3.2 Implementar `PATCH /api/me { default_office_id }`.
- [ ] 3.3 Implementar `POST /api/offices/:id/admins { user_id }` (solo super-admin).
- [ ] 3.4 Implementar `DELETE /api/offices/:id/admins/:userId` (solo super-admin).
- [ ] 3.5 (test integration) Cada endpoint cubre los casos felices y los 403/404.

## 4. Frontend — selector

- [ ] 4.1 Crear `frontend/src/ui/office-selector.ts` con `mountOfficeSelector(parent, current, offices, onChange)`.
- [ ] 4.2 CSS de selector en `style.css` con paleta arcade.
- [ ] 4.3 Integrar en HUD: top-left, debajo del logo si lo hubiera.
- [ ] 4.4 Click → cambia escena con la nueva oficina; cierra WS anterior y abre el nuevo room.
- [ ] 4.5 Persistir id en `localStorage["vo_last_office"]`.
- [ ] 4.6 (test unit FE) `mountOfficeSelector` muestra la oficina actual y dispara onChange con id correcto al click.

## 5. Lógica de selección al login

- [ ] 5.1 En `LoginScene.handleCredential`: tras autenticar, fetch `/api/me` y `/api/offices`.
- [ ] 5.2 Aplicar la prioridad: server default → localStorage → primera admin → primera visible → "sin oficina".
- [ ] 5.3 Pantalla "sin oficina" muestra mensaje "Aún no hay oficinas. Pide a un admin que cree una".
- [ ] 5.4 (test e2e) Usuario sin `default_office_id` y con dos oficinas, va a la primera.
- [ ] 5.5 (test e2e) Usuario con `default_office_id=2` va directamente a la 2.

## 6. Bootstrap

- [ ] 6.1 Script `backend/scripts/bootstrap-admin.ts` que crea/promociona un usuario a super-admin por email.
- [ ] 6.2 Documentar en `README.md` cómo correrlo.
- [ ] 6.3 Tarea separada en `package.json`: `pnpm bootstrap:admin <email>`.

## 7. Verificación

- [ ] 7.1 `pnpm test` (unit + integration) en verde.
- [ ] 7.2 `pnpm e2e:chromium` en verde con flujo completo "login → selector → cambiar a otra oficina → reservar".
- [ ] 7.3 Inspección manual: 2 oficinas, cambiar entre ambas, ver bookings independientes.
- [ ] 7.4 `openspec validate --all --strict` en verde.
