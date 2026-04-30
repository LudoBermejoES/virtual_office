/**
 * E2E de fixed assignments. Sin sesión real con Google, validamos las protecciones
 * de los endpoints. Los flujos completos están cubiertos en tests de integración backend.
 */
import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

test("POST /api/desks/1/fixed sin sesión devuelve 401", async ({ request }) => {
  const res = await request.post(`${BACKEND_BASE}/api/desks/1/fixed`, {
    data: { userId: 1 },
  });
  expect(res.status()).toBe(401);
});

test("DELETE /api/desks/1/fixed sin sesión devuelve 401", async ({ request }) => {
  const res = await request.delete(`${BACKEND_BASE}/api/desks/1/fixed`);
  expect(res.status()).toBe(401);
});
