/**
 * E2E de bookings. Sin sesión Google real, validamos las protecciones
 * del endpoint a nivel de API. Los flujos completos están cubiertos en
 * tests de integración backend (booking + delete + GET con bookings).
 */
import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

test("POST /api/desks/1/bookings sin sesión devuelve 401", async ({ request }) => {
  const res = await request.post(`${BACKEND_BASE}/api/desks/1/bookings`, {
    data: { date: "2026-12-31" },
  });
  expect(res.status()).toBe(401);
});

test("DELETE /api/desks/1/bookings sin sesión devuelve 401", async ({ request }) => {
  const res = await request.delete(`${BACKEND_BASE}/api/desks/1/bookings`, {
    data: { date: "2026-12-31" },
  });
  expect(res.status()).toBe(401);
});

test("GET /api/offices/1?date=YYYY-MM-DD sin sesión devuelve 401", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/offices/1?date=2026-12-31`);
  expect(res.status()).toBe(401);
});
