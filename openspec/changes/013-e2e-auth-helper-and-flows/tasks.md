# Tareas: e2e auth helper + flujos completos

## 1. Plugin de test-auth en backend

- [x] 1.1 Añadir `TEST_AUTH` (enum `"on"|"off"`, default `"off"`) al schema Zod de `env.ts`.
- [x] 1.2 Crear `backend/src/http/routes/test-auth.ts` con `POST /api/test/session` (Zod body, generación de JWT idéntica a auth.service).
- [x] 1.3 Registrar el plugin condicionalmente en `buildServer` solo si `env.TEST_AUTH === "on"`.
- [x] 1.4 Fail-fast al arrancar si `TEST_AUTH === "on" && NODE_ENV === "production"`.
- [x] 1.5 (test integration) `POST /api/test/session` crea usuario nuevo y devuelve cookie firmada válida.
- [x] 1.6 (test integration) Con `NODE_ENV=production` y `TEST_AUTH=on`, `buildServer` lanza error fatal.
- [x] 1.7 (test integration) Con `TEST_AUTH=off`, `POST /api/test/session` devuelve 404.

## 2. Helper Playwright

- [x] 2.1 Crear `frontend/tests/e2e/support/auth.ts` con `loginAs(request, context, user)`.
- [x] 2.2 Crear helper `setupTestOffice(request)` que crea una oficina mínima de pruebas y devuelve handles a sus desks.
- [x] 2.3 Helpers exportan tipos `TestUser`, `TestOffice` desde `support/types.ts`.

## 3. Flujos e2e

- [x] 3.1 `tests/e2e/flows/booking-flow.spec.ts`: reservar A1, recargar, sigue reservada; liberar, vuelve a libre.
- [x] 3.2 `tests/e2e/flows/realtime-flow.spec.ts`: dos contexts, Alice reserva, Bob ve el cambio en < 2 s sin recargar.
- [x] 3.3 `tests/e2e/flows/fixed-flow.spec.ts`: admin marca fijo, miembro no admin recibe 403 en `POST /api/fixed-assignments`.
- [x] 3.4 `tests/e2e/flows/invitation-flow.spec.ts`: admin crea invitación, externo entra por `/invite/<token>`, su sesión queda con el email correcto.
- [x] 3.5 `tests/e2e/flows/day-navigation-flow.spec.ts`: reservar día +1, navegar a hoy (no aparece), volver a +1 (aparece).

## 4. Visual regression con sesión real

- [ ] 4.1 Regenerar `login-scene.png` con sesión limpia.
- [ ] 4.2 Crear baseline `office-scene-states.png` con un desk libre, uno mío, uno ocupado y uno fijo, usando `loginAs` + `setupTestOffice`.
- [ ] 4.3 Crear baseline `booking-modal.png` con la fecha formateada en castellano.

## 5. CI

- [x] 5.1 Añadir job `e2e-chromium` en `.github/workflows/ci.yml`.
- [x] 5.2 Job arranca backend con `TEST_AUTH=on NODE_ENV=test`, espera healthz, arranca frontend, corre `pnpm e2e:chromium`.
- [x] 5.3 Suben artefactos: `playwright-report/` y `test-results/` en caso de fallo.
- [x] 5.4 Documentar en `doc/tests/README.md` cómo correr los flujos en local.

## 6. Verificación

- [x] 6.1 `pnpm test` (unit + integration) en verde.
- [ ] 6.2 `pnpm e2e:chromium` en verde con todos los flujos nuevos.
- [x] 6.3 Tests de seguridad: con `NODE_ENV=production` el plugin no está; con `TEST_AUTH=off` el endpoint devuelve 404.
- [x] 6.4 `openspec validate --all --strict` en verde.
