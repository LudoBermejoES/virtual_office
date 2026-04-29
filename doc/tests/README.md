# Estrategia de Tests — Teimas Space

> Aproximación TDD para la oficina virtual: tests-first, pirámide invertida ligera, feedback rápido en local y en CI.

## Filosofía

1. **Test-first**. Cada requisito de spec OpenSpec se traduce en uno o varios tests *antes* de escribir el código. Sin test rojo, no se escribe código.
2. **Feedback rápido**. La capa unitaria debe correr en menos de 5 segundos; la de integración en menos de 30; el e2e en menos de 3 minutos.
3. **Confianza realista**. Los tests de integración pegan a una SQLite real (no a un mock). Los e2e abren la app en un navegador real.
4. **Mock de los bordes, real en el resto**. Solo se mockea Google OAuth, Sentry y el reloj del sistema. Todo lo demás corre real.

---

## Pirámide

```
                  ┌─────────────────┐
                  │  E2E Playwright │   ~10-20 tests   ←  flujos críticos
                  ├─────────────────┤
                  │  Integration    │   ~80-150 tests  ←  HTTP + DB + WS reales
                  │  Vitest+Supertest                       
                  ├─────────────────┤
                  │      Unit       │   ~300+ tests    ←  servicios, geometría,
                  │     Vitest                              parsers, validators
                  └─────────────────┘
```

| Nivel | Herramienta | Qué prueba | Dónde corre | Objetivo |
|-------|-------------|------------|-------------|----------|
| Unit | Vitest | Funciones puras: dominio, geometría de polígonos, validators, parsers de fecha, cálculo de disponibilidad | Node sin red ni FS | <5s todo el suite |
| Integration | Vitest + Supertest + `node:sqlite` | Rutas HTTP, repos, broadcast WS | Node con SQLite en `:memory:` | <30s todo el suite |
| E2E | Playwright | Flujos completos en navegador real con backend real | Backend en puerto efímero + Chromium | <3min full suite |
| Visual (Phaser) | Playwright + screenshots | Render del mapa, máscaras circulares, fuentes | Chromium con baseline | Solo PR de UI |

---

## Stack y por qué

### Vitest (no Jest)

- **ESM nativo**: el proyecto es ESM puro (Node 24 + Phaser 4). Jest necesita Babel/ts-jest para ESM y aún así ralentiza la CI.
- **TypeScript out-of-the-box** vía esbuild, sin transformer extra.
- **10-20× más rápido** que Jest en watch mode, crítico para el ciclo *red → green → refactor* del TDD.
- **Misma config que Vite**, así el frontend Phaser y el backend comparten convenciones.
- **API compatible con Jest**, migración trivial si en el futuro hace falta.

### Supertest (integration HTTP)

- Bind del servidor al puerto efímero, request real sin hacer fetch externo.
- Composable con Vitest: cada test crea su propio servidor con DB `:memory:` aislada.

### Playwright (e2e + visual)

- **Auto-wait** elimina los `sleep` flaky.
- **Tracer + video** en fallos: imprescindible cuando un test falla solo en CI.
- **Component testing experimental** para piezas Phaser aisladas (canvas real, no jsdom).
- **Multi-browser** (Chromium / Firefox / WebKit) para detectar problemas de WebGL.

### `node:sqlite` para tests, no `better-sqlite3`

El stack productivo usa el módulo nativo de Node. Los tests usan el mismo módulo en modo `:memory:`. Cero divergencia entre test y prod, sin dependencia C++ que recompilar en CI.

---

## Convenciones TDD

### Ciclo

```
1. Leer el Scenario del spec OpenSpec   (Given/When/Then)
2. Escribir un test que falle            (red)
3. Implementar lo mínimo para pasarlo    (green)
4. Refactorizar sin cambiar el test      (refactor)
5. Repetir con el siguiente Scenario
```

### Mapeo Scenario → Test

Cada `#### Scenario:` de un spec OpenSpec produce **un único test** con el mismo nombre. Si un Scenario es demasiado amplio para un único test, se refina partiéndolo en varios Scenarios *en el spec*, no en el código.

```ts
// ejemplo: spec daily-desk-booking, Scenario "Reserva en puesto libre"
test("reserva en puesto libre", async () => {
  // GIVEN
  const desk = await fixtures.deskAt(office, { label: "A1" });
  const user = await fixtures.userIn("teimas.com");

  // WHEN
  const res = await api(app)
    .post(`/api/desks/${desk.id}/bookings`)
    .auth(user)
    .send({ date: "2026-05-04" });

  // THEN
  expect(res.status).toBe(201);
  expect(res.body.bookedBy).toBe(user.id);
});
```

### Naming

- Carpeta `tests/unit/<dominio>/<archivo>.test.ts`
- Carpeta `tests/integration/<recurso>.test.ts`
- Carpeta `tests/e2e/<flujo>.spec.ts` (Playwright usa `.spec.ts` por convención)
- Test description en castellano, igual que los Scenarios de los specs

### Fixtures

Helpers en `tests/support/fixtures.ts`:

```ts
fixtures.userIn(domain, role?)        // crea User Google con sub aleatorio
fixtures.officeWithMap()              // crea Office con un PNG mínimo
fixtures.deskAt(office, { polygon })  // crea Desk con polígono válido
fixtures.bookingFor(user, desk, date) // crea Booking idempotente
fixtures.adminIn(domain)              // shortcut para admin
fixtures.invitedExternal(email)       // user con is_invited_external=true
```

Cada test recibe una DB aislada vía hook `beforeEach`:

```ts
import { setupTestDb } from "../support/db";
const db = setupTestDb(); // :memory:, migraciones, fixtures helpers
```

### Tiempo

`Date.now` se mockea con `vi.useFakeTimers()` cuando un test depende de fechas relativas (expiración de invitaciones, "hoy" para bookings).

### Google OAuth

`google-auth-library` se inyecta como dependencia. En tests se sustituye por un fake que devuelve un payload firmado falso. Ningún test pega contra `accounts.google.com`.

---

## Estructura de directorios

```
backend/
├── src/
└── tests/
    ├── unit/
    │   ├── domain/
    │   │   ├── booking.test.ts
    │   │   └── geometry.test.ts          ← polígonos / point-in-polygon
    │   └── infra/
    │       └── google-auth.test.ts
    ├── integration/
    │   ├── auth.test.ts                  ← /auth/google + verifyIdToken
    │   ├── invitations.test.ts
    │   ├── offices.test.ts
    │   ├── desks.test.ts
    │   ├── bookings.test.ts
    │   └── ws-occupancy.test.ts          ← WebSocket broadcast
    └── support/
        ├── db.ts
        ├── fixtures.ts
        └── google-auth-fake.ts

frontend/
├── src/
└── tests/
    ├── unit/
    │   ├── scenes/
    │   │   └── office-scene.test.ts      ← lógica de la escena, no canvas
    │   └── ui/
    │       └── desk-zone.test.ts         ← hit testing del polígono
    └── e2e/
        ├── login.spec.ts
        ├── pick-desk.spec.ts
        ├── admin-uploads-map.spec.ts
        ├── admin-draws-zones.spec.ts
        ├── admin-invites-external.spec.ts
        ├── admin-fixes-desk.spec.ts
        ├── day-navigation.spec.ts
        ├── realtime-other-user.spec.ts   ← dos navegadores en paralelo
        └── visual/
            └── pixel-typography.spec.ts  ← regresión visual de la fuente
```

---

## Patrón de tests por capa

### Unit (Vitest, sin red ni FS)

Aplica a:
- **Dominio puro**: cálculo de slots disponibles, validación de polígonos, cálculo de "ocupado/libre" por fecha.
- **Geometría**: punto en polígono, normalización de coordenadas, validación de SVG.
- **Validators**: shape de payloads, restricción de dominio del email.

```ts
import { isPointInPolygon } from "../../src/domain/geometry";

test("punto dentro de un polígono convexo", () => {
  const poly = [[0,0],[10,0],[10,10],[0,10]] as const;
  expect(isPointInPolygon([5,5], poly)).toBe(true);
});
```

### Integration (Vitest + Supertest + DB real)

Aplica a:
- Endpoints REST: `/api/auth`, `/api/offices`, `/api/desks`, `/api/bookings`.
- Repos contra SQLite `:memory:` con migraciones aplicadas.
- Broadcast WebSocket: levantar el server, conectar dos clientes `ws`, esperar mensaje.

Una integration test típica:

```ts
test("dos usuarios reciben la misma actualización de ocupación", async () => {
  const { app, wsUrl } = await startTestServer();
  const a = await connectWs(wsUrl, alice);
  const b = await connectWs(wsUrl, bob);

  await api(app).post(`/api/desks/${desk.id}/bookings`)
    .auth(alice).send({ date: "2026-05-04" });

  await expect(a).toReceive({ type: "desk.booked", deskId: desk.id });
  await expect(b).toReceive({ type: "desk.booked", deskId: desk.id });
});
```

### E2E (Playwright, navegador real, backend real)

Aplica a los flujos de usuario completos. Una test típica:

```ts
test("usuario reserva un puesto y otro lo ve ocupado en tiempo real", async ({ browser }) => {
  const ctxAlice = await browser.newContext({ storageState: "alice.json" });
  const ctxBob = await browser.newContext({ storageState: "bob.json" });
  const alice = await ctxAlice.newPage();
  const bob = await ctxBob.newPage();

  await alice.goto("/");
  await bob.goto("/");

  await alice.locator("[data-desk='A1']").click();
  await alice.getByRole("button", { name: "Reservar" }).click();

  await expect(bob.locator("[data-desk='A1'][data-status='occupied']"))
    .toBeVisible();
});
```

Los `storageState` se pre-generan en `tests/e2e/setup/seed-users.ts` simulando el callback de Google con tokens fake firmados por una clave de test.

---

## CI

### Jobs en paralelo

```
┌────────────────┐ ┌──────────────────┐ ┌────────────────┐
│ unit + integ   │ │ e2e Chromium     │ │ e2e Firefox    │
│ vitest run     │ │ playwright test  │ │ playwright test│
└────────────────┘ └──────────────────┘ └────────────────┘
        │                  │                     │
        └──────────┬───────┴─────────────────────┘
                   ▼
           Coverage gate ≥ 80%
```

### Reglas

- **PR no mergea con tests rojos**, no excepciones.
- **Coverage ≥ 80%** medido por Vitest (`v8` provider). Las líneas de bootstrap de Phaser y los entrypoints están excluidas.
- **Tests flaky**: cualquier test que falle de forma intermitente se *quarantena* en un job aparte y se abre issue. Cero tolerancia a `test.skip` sin issue asociado.
- **Snapshot visuals**: las baselines de Playwright viven en el repo. Una baseline solo se actualiza con un commit dedicado revisable.

---

## Mocking de Sentry y Winston

En tests, el logger se reemplaza por uno de prueba que captura logs en memoria:

```ts
import { createTestLogger } from "./support/logger";
const logger = createTestLogger();
expect(logger.errors).toContainEqual(/migración fallida/);
```

Sentry se inicializa solo si `process.env.SENTRY_DSN` está definido. En CI y en tests no se define, por lo que la captura es no-op.

---

## Checklist por requisito de spec

Antes de marcar un Scenario como `[x]` en `tasks.md`:

- [ ] Test unitario escrito *antes* del código.
- [ ] Test de integración cubriendo la ruta HTTP / WS si aplica.
- [ ] Test e2e cubriendo el flujo si afecta a un journey de usuario.
- [ ] Coverage local ≥ 80%.
- [ ] Refactor aplicado tras green.
- [ ] Lint y typecheck en verde.

---

## Anti-patrones que evitamos

| Anti-patrón | Por qué lo rechazamos | Alternativa |
|-------------|----------------------|-------------|
| Mockear el módulo `node:sqlite` | Divergencia silenciosa con prod | DB `:memory:` real |
| Mockear el repo en lugar del DB | Tests que pasan con bugs en SQL | DB `:memory:` real |
| `setTimeout` para esperar WS | Flakiness garantizada | `await onceMessage(socket)` con timeout |
| Snapshot de toda la página | Cambia con cualquier tweak de estilo | Snapshot recortado al canvas Phaser |
| `beforeAll` con DB compartida | Tests no aislados | `beforeEach` con DB nueva |
| Test que hace fetch a Google | Lento, frágil, requiere internet | Verifier inyectado |

---

## Fuentes consultadas

- [Vitest vs Jest 2026 — DevTools Research](https://devtoolswatch.com/en/vitest-vs-jest-2026)
- [Why Vitest in 2026 — howtotestfrontend](https://howtotestfrontend.com/resources/vitest-vs-jest-which-to-pick)
- [Testing Phaser Games with Vitest — DEV](https://dev.to/davidmorais/testing-phaser-games-with-vitest-3kon)
- [Playwright + Vitest — DEV](https://dev.to/yashpandey07/why-playwright-vitest-is-the-future-of-web-testing-4hg1)
- [E2E Testing a Video Game — Medium](https://medium.com/@philscode/e2e-testing-a-video-game-a12c7061385f)
- [Playwright end-to-end 2026 — BrowserStack](https://www.browserstack.com/guide/end-to-end-testing-using-playwright)
