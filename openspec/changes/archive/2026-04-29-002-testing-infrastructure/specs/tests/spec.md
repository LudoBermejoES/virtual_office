# Delta — Tests

## ADDED Requirements

### Requirement: Infraestructura de tests operativa
El sistema MUST exponer un suite de tests ejecutable que cubra unit, integration y e2e mediante Vitest, Supertest y Playwright respectivamente, con un umbral mínimo de cobertura del 80% en líneas, statements, branches y funciones.

#### Scenario: Ejecución de tests unit + integration
- GIVEN un developer en un clon limpio del repo tras `pnpm install`
- WHEN ejecuta `pnpm --filter backend test`
- THEN Vitest descubre los archivos `tests/**/*.test.ts`
- AND el suite termina con código 0
- AND el reporter muestra cobertura ≥ 80% en líneas, statements y funciones

#### Scenario: Ejecución de e2e
- GIVEN navegadores instalados con `pnpm exec playwright install chromium`
- WHEN ejecuta `pnpm --filter frontend e2e:chromium`
- THEN Playwright arranca el backend en puerto efímero vía `globalSetup`
- AND ejecuta los tests del directorio `tests/e2e/`
- AND termina con código 0

#### Scenario: Aislamiento de DB entre tests
- GIVEN dos archivos de test que usan `setupTestDb()`
- WHEN se ejecutan en paralelo
- THEN cada uno opera contra una DB `:memory:` independiente
- AND no observa filas creadas por el otro

#### Scenario: Verificación de ID token de Google fakeada
- GIVEN un test que llama a `googleVerifier.verifyIdToken`
- WHEN no ha invocado `setNextPayload` previamente
- THEN el helper lanza un error explícito `"test forgot to setNextPayload"`
- AND el test falla con mensaje legible

### Requirement: Trace de Playwright en fallo
El sistema MUST generar un trace navegable cuando un test e2e falla, para facilitar el debugging en CI.

#### Scenario: Test e2e falla en CI
- GIVEN un test e2e que falla en el primer intento
- WHEN se ejecuta con `retries=2`
- THEN Playwright registra trace y video del primer reintento
- AND el archivo aparece bajo `test-results/` para descargarlo desde el job
