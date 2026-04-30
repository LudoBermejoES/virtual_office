# Propuesta: E2E auth helper + flujos completos

## Motivación

Tras 12 changes, el suite e2e (`frontend/tests/e2e/*.spec.ts`) solo verifica respuestas de endpoints del backend o estados CSS aislados. **No existe un solo flujo end-to-end automatizado que cubra el camino crítico**: "login → ver oficina → reservar puesto → ver desk ocupado en realtime → recargar y persistir → liberar". Sin esto, regresiones funcionales pasan inadvertidas hasta producción.

Falta también la pieza habilitante: un helper de sesión para Playwright que evite tener que hacer login real con Google (imposible automatizar) y permita inyectar una cookie JWT firmada por el backend de test.

## Alcance

**En scope:**
- Helper `loginAs(page, { email, role })` en `tests/e2e/support/auth.ts` que llama a un endpoint `POST /api/test/session` (solo activo cuando `TEST_AUTH=on`) y deja la cookie de sesión lista en el contexto del browser.
- Endpoint backend `POST /api/test/session` que genera un JWT igual al de producción, **registrado solo si `process.env.TEST_AUTH === "on"`** y `NODE_ENV !== "production"`. Recibe `{ email, role: "admin"|"member"|"external" }` y devuelve la cookie.
- Flujos e2e completos:
  - **booking-flow**: usuario A reserva A1, recarga, sigue reservada; libera, vuelve a estar libre.
  - **realtime-flow**: dos contextos browser (Alice y Bob); Alice reserva, Bob ve el cambio sin recargar.
  - **fixed-flow**: admin marca A1 fijo a Carla, Carla lo ve fijo, Diana intenta reservar → bloqueado.
  - **invitation-flow**: admin crea invitación, externo abre el link, login, queda asignado al usuario.
  - **day-navigation-flow**: reservar para mañana, navegar entre días, ver el estado correcto en cada uno.
- Visual baselines (5.2-5.4 del change 012) regenerados con sesión real, ahora que el helper existe.

**Fuera de scope:**
- Helpers para Cypress u otros frameworks.
- Tests de carga (eso es change 019).
- Mobile e2e (eso es otro change futuro).

## Dominios afectados

`autenticacion` (extensión: endpoint de test).

## Orden y dependencias

Change `013`. Depende de `001`-`012` archivados (todo el sistema funcional).

## Impacto de seguridad

**Crítico** — el endpoint `/api/test/session` permite generar sesión sin pasar por Google. Mitigaciones:
- Solo se registra si `TEST_AUTH === "on"` AND `NODE_ENV !== "production"`.
- En el arranque, si ambas condiciones se cumplen y `NODE_ENV === "production"`, el servidor MUST fallar con error fatal y no arrancar.
- Documentar en `README.md` y en `doc/be/README.md` la regla.
- Añadir test que verifica que con `NODE_ENV=production` y `TEST_AUTH=on` el `buildServer` lanza error.

## Rollback

Trivial: borrar el plugin `test-auth` y los flujos e2e nuevos.
