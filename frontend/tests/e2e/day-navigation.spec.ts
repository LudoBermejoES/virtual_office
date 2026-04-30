/**
 * E2E de navegación por días. La UI Phaser/HUD requiere el frontend dev server
 * y sesión real con Google; aquí verificamos el contrato API que la UI usa.
 * Los flujos de UI completos están cubiertos en tests unit (state/ui.ts) y backend.
 */
import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

test("GET /api/offices/1?date=2026-12-31 sin sesión devuelve 401", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/offices/1?date=2026-12-31`);
  expect(res.status()).toBe(401);
});

test("GET /api/offices/1?date=YYYY-MM-DD para día arbitrario sigue devolviendo 401 sin sesión", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/offices/1?date=2026-06-15`);
  expect(res.status()).toBe(401);
});
