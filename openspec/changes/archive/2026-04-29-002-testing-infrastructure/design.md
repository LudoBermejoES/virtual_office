# Diseño técnico: Testing Infrastructure

## Stack y por qué

Detallado en `doc/tests/README.md`. Resumen:

- **Vitest** (no Jest) por velocidad, ESM nativo y compatibilidad con Vite del frontend.
- **Supertest** sobre el server Fastify ya levantado, sin abrir socket público.
- **Playwright** para e2e con auto-wait, video y trace en fallo.
- **DB `:memory:` real** vía `node:sqlite`. Sin mocks de DB.
- **Coverage v8**.

## Estructura

```
backend/
├── vitest.config.ts
└── tests/
    ├── unit/
    ├── integration/
    └── support/
        ├── db.ts                      ← setupTestDb(): crea :memory:, corre migraciones
        ├── server.ts                  ← startTestServer(): server Fastify aislado
        ├── fixtures.ts                ← userIn, deskAt, bookingFor, adminIn, ...
        ├── google-auth-fake.ts        ← verifyIdToken stub controlable por test
        ├── logger-test.ts             ← logger en memoria con assertions
        └── ws-client.ts               ← helpers para conectar y await mensajes

frontend/
├── vitest.config.ts
├── playwright.config.ts
└── tests/
    ├── unit/
    └── e2e/
        ├── setup/
        │   ├── global-setup.ts        ← arranca backend en puerto efímero
        │   └── seed-users.ts          ← genera storageState para alice/bob/admin
        └── support/
            └── pages.ts                ← page objects ligeros
```

## Vitest backend

```ts
// backend/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 80, statements: 80, branches: 75, functions: 80 },
      include: ["src/**"],
      exclude: ["src/server.ts", "src/config/env.ts"],
    },
    pool: "forks",        // aislamiento real entre archivos para DB :memory:
    isolate: true,
  },
});
```

## Vitest frontend

```ts
// frontend/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",   // tests del dominio sin DOM
    include: ["tests/unit/**/*.test.ts"],
  },
});
```

## Playwright

```ts
// frontend/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/setup/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
});
```

`global-setup.ts`:

1. Arranca backend en puerto efímero con DB temporal.
2. Aplica migraciones.
3. Inserta seed: `alice@teimas.com` (member), `bob@teimas.com` (member), `admin@teimas.com` (admin).
4. Genera storageState por usuario simulando login con Google fake.
5. Expone `PLAYWRIGHT_BASE_URL`.
6. Devuelve `teardown` que mata el proceso y borra la DB.

## Fake de Google verifier

`google-auth-library` se inyecta como dependencia. En tests:

```ts
// tests/support/google-auth-fake.ts
export class FakeGoogleVerifier {
  next: { sub: string; email: string; hd?: string; name: string; picture?: string } | null = null;
  setNextPayload(p: typeof this.next) { this.next = p; }
  async verifyIdToken(_tok: string) {
    if (!this.next) throw new Error("test forgot to setNextPayload");
    return { getPayload: () => this.next! };
  }
}
```

`startTestServer({ googleVerifier: fake })` lo inyecta. Cero llamadas reales a Google.

## Helpers de fixtures

```ts
fixtures.userIn(domain, role?)        // inserta user con google_sub aleatorio
fixtures.adminIn(domain)              // shortcut role=admin
fixtures.invitedExternal(email)       // inserta user is_invited_external=1
fixtures.officeWithMap()              // crea office + escribe PNG mínimo en tmp dir
fixtures.deskAt(office, polygon)      // inserta desk
fixtures.bookingFor(user, desk, date) // inserta booking
```

Cada fixture devuelve el record completo (con id) para encadenar.

## CI

```yaml
# .github/workflows/ci.yml — esquema, no dentro del scope, pero referencia
jobs:
  unit-integration:
    steps:
      - pnpm install
      - pnpm typecheck
      - pnpm --filter backend test
      - pnpm --filter frontend test
  e2e-chromium:
    steps:
      - pnpm install
      - pnpm --filter frontend exec playwright install chromium
      - pnpm --filter frontend e2e:chromium
  e2e-firefox: ...
```

## Decisiones documentadas

- **Por qué `pool: "forks"`** — necesario para que cada archivo tenga su propia DB `:memory:` realmente aislada. `threads` no aísla `node:sqlite` correctamente entre tests del mismo worker.
- **Por qué backend Vitest no usa `environment: "jsdom"`** — los tests de backend no tocan DOM. El frontend solo usa Node para tests de dominio puro; el resto de UI vive en e2e con navegador real.
- **Por qué Playwright maneja el backend** — un único backend para todo el suite e2e, con seed estable. Más rápido que reiniciar por test.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Tests flaky por timeouts WS | Helper `awaitMessage(socket, predicate, { timeout: 2000 })` con error claro |
| Coverage gate hostil al inicio | Excluir entrypoints; subir gradualmente a 80% |
| Storage state caduca | Regenerar en cada `globalSetup`, no commitear |
| Playwright traces enormes en CI | `trace: "on-first-retry"` en lugar de `"on"` |
