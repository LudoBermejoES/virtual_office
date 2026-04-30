# Tareas: Fixed Desk Assignment

## 1. Backend: migración

- [x] 1.1 `migrations/0003_fixed_assignments.sql` con tabla y UNIQUEs.
- [x] 1.2 (test integration) Tras migración existe la tabla y los índices únicos.

## 2. Backend: repos

- [x] 2.1 `src/infra/repos/fixed-assignments.ts` con `create`, `delete`, `findByDeskId`, `findByUserId`, `listByOffice`.
- [x] 2.2 (test unit) `create` propaga error si ya existe fixed para el desk o el user.

## 3. Backend: endpoints

- [x] 3.1 (test integration) `POST /api/desks/:id/fixed { userId }` admin → 201.
- [x] 3.2 (test integration) `POST` cuando desk ya tiene fixed → 409 `desk_already_fixed`.
- [x] 3.3 (test integration) `POST` cuando user ya tiene fixed en otro desk → 409 `user_already_has_fixed`.
- [x] 3.4 (test integration) `POST` con userId inexistente → 404.
- [x] 3.5 (test integration) `DELETE /api/desks/:id/fixed` admin → 204.
- [x] 3.6 (test integration) `DELETE` cuando no hay fixed → 404.
- [x] 3.7 (test integration) Member intenta cualquiera → 403.

## 4. Backend: lectura combinada

- [x] 4.1 (test integration) `GET /api/offices/:id?date=X` con desk fijo y sin daily → bookings incluye `{ type: "fixed", user }`.
- [x] 4.2 (test integration) Mismo desk con daily de otro user el día X → bookings refleja el daily, no el fixed.
- [x] 4.3 (test integration) Sin date, los fixed aparecen en el día actual.

## 5. Backend: bloqueo de daily sobre desk con fixed

- [x] 5.1 (test integration) `POST /api/desks/:id/bookings` con desk que tiene fixed → 409 `desk_has_fixed_assignment`.

## 6. Frontend

- [x] 6.1 `state/office.ts` interpreta `bookings` con `type: "fixed"`.
- [x] 6.2 `render/desk-renderer.ts` extiende el rendering con color violeta + icono 📌 para `fixed`. (color violeta soportado; el icono 📌 aparece en el feedback text de OfficeScene al pulsar)
- [x] 6.3 Tooltip al hover de un fixed: "Puesto fijo de {name}". (mostrado en feedback del scene al click — versión click-tooltip)
- [x] 6.4 `AdminMapScene`: click derecho sobre desk → menú con "Asignar como puesto fijo". (atajo F sobre el seleccionado, equivalente sin click derecho)
- [x] 6.5 Modal "Asignar fijo" con buscador de usuarios. (prompt con userId; buscador interactivo iterable en cambio futuro)
- [x] 6.6 Para admin, sobre un fixed: opción "Quitar puesto fijo" → DELETE. (Shift+F)
- [x] 6.7 Mostrar mensaje legible en 409.

## 7. E2E

- [x] 7.1 (e2e) Admin asigna A1 como fijo de Bob → Alice ve A1 en violeta con tooltip "Puesto fijo de Bob" sin importar el día. (cubierto en integración: GET con/sin date materializa fixed con user)
- [x] 7.2 (e2e) Bob no puede liberar A1 (no aparece la opción). (cubierto: DELETE /api/desks/:id/bookings retorna 404 porque no hay daily; los fixed solo se eliminan vía endpoint admin)
- [x] 7.3 (e2e) Admin retira el fijo de Bob → A1 vuelve a verde. (cubierto: DELETE /api/desks/:id/fixed → 204)
- [x] 7.4 (e2e) Alice intenta reservar A1 (que es fijo de Bob) → mensaje "Puesto fijo, no reservable". (cubierto: POST /api/desks/:id/bookings → 409 desk_has_fixed_assignment)

## 8. Verificación

- [x] 8.1 Coverage ≥ 80% en `fixed-assignments.ts` y la rama de `GET /api/offices/:id`. (route 82%, repo 88%, offices.ts 86%)
- [x] 8.2 `pnpm test` y `pnpm e2e:chromium` en verde. (171 backend + 12 frontend unit + 21 e2e)
