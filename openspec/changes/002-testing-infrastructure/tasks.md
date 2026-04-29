# Tareas: Testing Infrastructure

## 0. ESLint + Prettier

- [x] 0.1 Añadir dependencias dev en raíz: `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-config-prettier`, `prettier`.
- [x] 0.2 Crear `eslint.config.mjs` raíz con reglas TS estrictas y `prettier` al final.
- [x] 0.3 Crear `.prettierrc` raíz con config (2 spaces, singleQuote, semicolons, printWidth 100).
- [x] 0.4 Añadir script `lint` en `package.json` raíz que linte los tres paquetes.
- [x] 0.5 Añadir script `format` en `package.json` raíz que formatee con `prettier --write`.
- [x] 0.6 Verificar: `pnpm lint` y `pnpm format --check` en verde sin errores.

## 1. Vitest backend

- [ ] 1.1 Añadir dependencias dev: `vitest`, `@vitest/coverage-v8`, `supertest`, `@types/supertest`.
- [ ] 1.2 Crear `backend/vitest.config.ts` con `pool: "forks"`, coverage v8, threshold 80%.
- [ ] 1.3 Añadir scripts en `backend/package.json`: `test`, `test:watch`, `test:coverage`.

## 2. Helpers backend

- [ ] 2.1 `tests/support/db.ts` con `setupTestDb()` que abre `:memory:`, corre migraciones y devuelve handle + cleanup.
- [ ] 2.2 `tests/support/server.ts` con `startTestServer({ googleVerifier })` que retorna `{ app, wsUrl, teardown }`.
- [ ] 2.3 `tests/support/fixtures.ts` con `userIn`, `adminIn`, `invitedExternal`, `officeWithMap`, `deskAt`, `bookingFor`.
- [ ] 2.4 `tests/support/google-auth-fake.ts` con `FakeGoogleVerifier` y `setNextPayload`.
- [ ] 2.5 `tests/support/logger-test.ts` con logger en memoria que expone `errors`, `warns`, `infos`.
- [ ] 2.6 `tests/support/ws-client.ts` con `connectWs(url, user)` y `awaitMessage(socket, predicate, opts)`.

## 3. Vitest frontend

- [ ] 3.1 Añadir dependencias dev: `vitest`, `@vitest/coverage-v8`.
- [ ] 3.2 `frontend/vitest.config.ts` con `environment: "node"` para dominio puro.
- [ ] 3.3 Test smoke: `tests/unit/sanity.test.ts` que ejecute `expect(1+1).toBe(2)`.

## 4. Playwright

- [ ] 4.1 Añadir dependencia dev: `@playwright/test`.
- [ ] 4.2 `playwright.config.ts` con projects chromium/firefox y `globalSetup`.
- [ ] 4.3 `tests/e2e/setup/global-setup.ts` que arranca backend en puerto efímero.
- [ ] 4.4 `tests/e2e/setup/seed-users.ts` que genera storageState para `alice`, `bob`, `admin`.
- [ ] 4.5 Test smoke: `tests/e2e/smoke.spec.ts` que carga `/healthz` y verifica `status: ok`.

## 5. CI

- [ ] 5.1 Documentar pipeline esperado en `doc/tests/README.md` (referencia al diseño).
- [ ] 5.2 Validar que `pnpm test` global ejecuta backend + frontend.

## 6. TDD self-tests

- [ ] 6.1 Test unit: `setupTestDb()` tiene la tabla `_migrations` con la versión 1 aplicada.
- [ ] 6.2 Test unit: `FakeGoogleVerifier.verifyIdToken` falla si no se llamó a `setNextPayload`.
- [ ] 6.3 Test integration: dos `setupTestDb()` en serie no comparten estado.
- [ ] 6.4 Test e2e smoke: `/healthz` responde 200 a través de Playwright.

## 7. Verificación

- [ ] 7.1 `pnpm --filter backend test` pasa con coverage ≥ 80%.
- [ ] 7.2 `pnpm --filter frontend test` pasa.
- [ ] 7.3 `pnpm --filter frontend e2e:chromium` pasa.
- [ ] 7.4 Trace de Playwright generado en `test-results/` cuando un test falla a propósito.
