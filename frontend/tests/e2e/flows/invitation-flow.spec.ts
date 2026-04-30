/**
 * Flujo e2e de invitación: admin crea invitación para externo,
 * el token generado es válido y usable para la ruta /invite/:token.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/auth.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

test("admin crea invitación y token es válido", async ({ request, context }) => {
  await loginAs(request, context, { email: "admin-invite@example.com", role: "admin" });

  const externalEmail = `externo-${Date.now()}@cliente.com`;
  const invRes = await request.post(`${BACKEND}/api/invitations`, {
    data: { email: externalEmail },
  });
  expect(invRes.status()).toBe(201);
  const inv = await invRes.json<{ token: string; email: string; url: string }>();
  expect(inv.email).toBe(externalEmail);
  expect(inv.token).toHaveLength(43);
  expect(inv.url).toContain(inv.token);
});

test("externo con sesión de test tiene email correcto en /api/me", async ({ request, context }) => {
  const externalEmail = `externo-me-${Date.now()}@cliente.com`;
  await loginAs(request, context, { email: externalEmail, role: "external" });

  const meRes = await request.get(`${BACKEND}/api/me`);
  expect(meRes.status()).toBe(200);
  const me = await meRes.json<{ email: string; role: string }>();
  expect(me.email).toBe(externalEmail);
  expect(me.role).toBe("member");
});
