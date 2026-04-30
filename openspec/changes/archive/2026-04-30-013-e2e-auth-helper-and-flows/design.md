# Diseño técnico: e2e auth helper + flujos

## Endpoint `POST /api/test/session`

Registrado en `backend/src/http/routes/test-auth.ts`. Plugin Fastify autoregistrado solo si:

```ts
if (env.TEST_AUTH === "on") {
  if (env.NODE_ENV === "production") {
    throw new Error("FATAL: TEST_AUTH=on en NODE_ENV=production");
  }
  await app.register(testAuthRoutes, { prefix: "/api/test" });
}
```

Body Zod:

```ts
const TestSessionBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "external"]),
});
```

Comportamiento:
1. Busca el usuario por email; si no existe, lo crea con `role` solicitado.
2. Si `role==="admin"`, marca `users.is_admin=1`.
3. Genera el JWT exactamente como `auth.service.ts` (HS256, mismo `JWT_SECRET`, mismo `exp`).
4. Devuelve `Set-Cookie: vo_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/`.

## Helper Playwright

`frontend/tests/e2e/support/auth.ts`:

```ts
export async function loginAs(
  request: APIRequestContext,
  context: BrowserContext,
  user: { email: string; role: "admin" | "member" | "external" },
): Promise<void> {
  const res = await request.post(`${BACKEND}/api/test/session`, { data: user });
  if (!res.ok()) throw new Error(`loginAs failed: ${res.status()}`);
  const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
  await context.addCookies(parseSetCookie(cookies, FRONTEND_HOSTNAME));
}
```

## Flujos e2e

Estructura: cada flujo en `tests/e2e/flows/<name>-flow.spec.ts`.

| Flujo | Lo que cubre |
|-------|--------------|
| `booking-flow` | Reservar, recargar, persistencia, liberar |
| `realtime-flow` | Dos browsers, Alice reserva, Bob ve cambio en < 2s |
| `fixed-flow` | Admin asigna fijo, no admin no puede |
| `invitation-flow` | Admin crea invitación, externo entra por `/invite/<token>`, sesión queda con su email |
| `day-navigation-flow` | Reservar día +1, navegar a día actual, no aparece; volver y aparece |

Cada flujo monta su propia oficina vía un fixture `setupTestOffice()` que:
- Crea oficina con `POST /api/offices` (multipart con `.tmj` y un PNG 1×1 de tileset).
- Crea N desks vía `POST /api/desks`.
- Devuelve `{ officeId, desks: [{id, label, x, y}, ...] }`.

## CI

GitHub Actions:
1. `npm run dev:backend` con `TEST_AUTH=on` y `NODE_ENV=test`.
2. Espera healthz.
3. `npm run dev:frontend` (Vite).
4. `pnpm e2e:chromium`.

Variables: `PLAYWRIGHT_BASE_URL=http://localhost:18081`, `PLAYWRIGHT_FRONTEND_URL=http://localhost:5173`, `TEST_AUTH=on`.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El endpoint de test queda activo en prod por error | Fail-fast en arranque si `TEST_AUTH=on && NODE_ENV=production` + test que lo verifica |
| Flakiness en realtime test | Esperar al evento WS con `page.waitForResponse`/`page.waitForFunction` con timeout explícito 3s |
| Mantenimiento alto de fixtures | Helper único `setupTestOffice()` reutilizable, mapas mínimos pre-generados en `tests/e2e/support/fixtures/` |
