---
name: tdd-cycle
description: Ejecuta un ciclo TDD red→green→refactor para un Scenario concreto de un spec OpenSpec del proyecto Virtual Office. Úsala cuando el usuario diga "haz TDD del scenario X de Y" o cuando estés implementando tasks.md y necesites disciplina TDD.
---

# Ciclo TDD para un Scenario OpenSpec

Esta skill orquesta la disciplina TDD obligatoria del proyecto: cada `#### Scenario:` produce un test que se escribe **antes** del código.

## Input

El usuario indica:
- El **change** sobre el que trabajamos (p. ej. `007-daily-desk-booking`).
- El **dominio** del spec (p. ej. `reservas`).
- El **Scenario** concreto (p. ej. `"Reserva en puesto libre"`).

Si falta alguno, pregúntalo con AskUserQuestion antes de continuar.

## Pasos

### 1. Localizar el Scenario en el spec

Lee `openspec/changes/<change>/specs/<dominio>/spec.md` y extrae el bloque `#### Scenario: <nombre>` con sus líneas `- GIVEN/WHEN/THEN/AND`. Si no existe, para y avisa.

### 2. Decidir capa de test

Por las pistas del Scenario:

| Pista | Capa |
|-------|------|
| GIVEN ... server arrancado / cliente / cookie / endpoint | **integration** (Vitest + Supertest contra `:memory:`) |
| GIVEN ... usuario en pantalla / hace click / arrastra / ve | **e2e** (Playwright) |
| GIVEN ... función / valor / payload / coords / dominio puro | **unit** (Vitest sin red ni FS) |
| GIVEN ... dos clientes WS / broadcast | **integration** con `tests/support/ws-client.ts` |

Si dudas, integration suele ser la apuesta correcta para HTTP / DB; unit para `domain/`; e2e solo para journeys completos de usuario.

### 3. Escribir el test (RED)

Crea o extiende el archivo correspondiente según las convenciones de `doc/tests/README.md`:

- Backend: `backend/tests/unit/<dominio>/<archivo>.test.ts`, `backend/tests/integration/<recurso>.test.ts`.
- Frontend: `frontend/tests/unit/<area>/<archivo>.test.ts`.
- E2E: `frontend/tests/e2e/<flujo>.spec.ts`.

Reglas:
- **Nombre del test = nombre del Scenario en castellano**, copiado literal.
- Estructura GIVEN / WHEN / THEN replica el cuerpo del Scenario en el test.
- Usa los helpers de `tests/support/`: `setupTestDb()`, `startTestServer()`, `fixtures.userIn`, `fixtures.deskAt`, `fixtures.bookingFor`, `FakeGoogleVerifier`, `connectWs`, `awaitMessage`.
- **No mockees `node:sqlite`**: DB `:memory:` real.
- Si la fecha es relevante usa `vi.useFakeTimers()` y fija `Date.now`.

Lanza el test y **confirma que falla** con el mensaje esperado. Si pasa de primeras, el test no testea lo que crees: revísalo.

### 4. Implementar mínimo (GREEN)

Escribe el código mínimo en `backend/src/...` o `frontend/src/...` para que el test pase:

- Respeta la separación de capas: `http → services → domain` y `services → infra`.
- `domain/` no importa de `infra/` ni de `http/`.
- Validación con Zod en cada borde.
- Sin `console.log`: usa el logger Winston.
- Sin PII en logs (ni email completo, ni tokens).

Vuelve a lanzar el test y confirma que pasa.

### 5. Refactorizar

Sin tocar el test:

- Extrae helpers comunes a `domain/` o a `tests/support/`.
- Renombra para clarificar.
- Asegura que coverage de los archivos tocados sigue ≥ 80%.

### 6. Lint + typecheck

```bash
pnpm typecheck
pnpm lint
```

Ambos en verde.

### 7. Marcar la tarea completada

En `openspec/changes/<change>/tasks.md`, encuentra la línea que corresponde al Scenario y cambia `[ ]` por `[x]`. Si la tarea cubre varios Scenarios, no la marques hasta que todos pasen.

### 8. Resumen final

Reporta al usuario en una o dos frases: qué scenario se cubrió, archivo de test creado, archivos de código tocados.

## Reglas duras

- **No saltes el RED**. Si el test pasa antes de implementar, está mal escrito.
- **No mezcles varios Scenarios en un test**. Un Scenario = un test.
- **No aceptes "verde" con `.skip` o `xit`**.
- **No marques `[x]` en tasks.md sin coverage real ≥ 80% en los archivos tocados**.
- **No introduzcas dependencias nuevas sin avisar**: el stack está fijado en CLAUDE.md.

## Si algo no encaja

Si el Scenario no es testeable como está escrito (ambiguo, falta info), **modifica primero el spec** para clarificarlo, valida con `openspec validate --strict`, y entonces vuelve al ciclo TDD. No fuerces un test contra un Scenario mal definido.
