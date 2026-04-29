# Propuesta: Testing Infrastructure

## Motivación

Adoptar TDD requiere que la infraestructura de tests esté operativa **antes** de empezar features. Cada Scenario de los specs siguientes se traducirá en un test que se escribe primero (red), después el código (green). Sin Vitest, Supertest, Playwright y los helpers de fixtures, el ciclo TDD no es viable.

## Alcance

**En scope:**
- Configurar Vitest para backend (unit + integration con DB `:memory:` real).
- Configurar Vitest para frontend (unit del dominio puro, sin canvas).
- Configurar Playwright para e2e con un backend real arrancando en puerto efímero.
- Helpers `tests/support/`: fixtures, DB helper, fake de Google verifier, fake de logger, helpers de WebSocket.
- Coverage gate ≥ 80% con provider `v8`.
- Job de CI documentado (matriz: unit+integration, e2e Chromium, e2e Firefox).
- Convenciones: nombres de tests en castellano alineados con los Scenarios de los specs.

**Fuera de scope:**
- Tests de features concretas — viven en sus respectivos changes.
- Visual regression de Phaser — se monta en `012-videogame-typography`.
- Performance tests / load tests.

## Dominios afectados

Ninguno funcional. Solo añade tooling. El doc maestro de la estrategia es `doc/tests/README.md`.

## Orden y dependencias

Change `002`. Depende de `001` (necesita el scaffolding del monorepo).

## Impacto de seguridad

- El fake de Google verifier debe estar **encerrado en `tests/`** y nunca expuesto al runtime productivo.
- Las claves de firma usadas por los fixtures de e2e son de test, generadas en cada CI run, nunca commiteadas.

## Rollback

Eliminar `vitest.config.ts`, `playwright.config.ts` y la carpeta `tests/`. La aplicación sigue funcionando.
