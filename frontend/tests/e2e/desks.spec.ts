/**
 * E2E de desks. Sin sesión real con Google, validamos que las protecciones
 * del endpoint funcionan; los flujos de UI están cubiertos por tests
 * de integración backend.
 */
import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

test("POST /api/offices/1/desks sin sesión devuelve 401", async ({ request }) => {
  const res = await request.post(`${BACKEND_BASE}/api/offices/1/desks`, {
    data: { label: "A1", x: 100, y: 100 },
  });
  expect(res.status()).toBe(401);
});

test("PATCH /api/desks/1 sin sesión devuelve 401", async ({ request }) => {
  const res = await request.patch(`${BACKEND_BASE}/api/desks/1`, {
    data: { label: "X" },
  });
  expect(res.status()).toBe(401);
});

test("DELETE /api/desks/1 sin sesión devuelve 401", async ({ request }) => {
  const res = await request.delete(`${BACKEND_BASE}/api/desks/1`);
  expect(res.status()).toBe(401);
});

test("POST /api/offices/1/desks/import-from-tiled sin sesión devuelve 401", async ({ request }) => {
  const res = await request.post(`${BACKEND_BASE}/api/offices/1/desks/import-from-tiled`);
  expect(res.status()).toBe(401);
});
