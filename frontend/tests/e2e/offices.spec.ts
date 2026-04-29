/**
 * E2E de upload de mapa Tiled.
 * Como el flujo admin requiere cookie de sesión y el verifier real no se simula
 * en e2e, validamos las protecciones del endpoint a nivel de API.
 */
import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

test("POST /api/offices sin sesión devuelve 401", async ({ request }) => {
  const res = await request.post(`${BACKEND_BASE}/api/offices`, {
    multipart: {
      name: "X",
      tmj: { name: "x.tmj", mimeType: "application/json", buffer: Buffer.from("{}") },
    },
  });
  expect(res.status()).toBe(401);
});

test("GET /api/offices sin sesión devuelve 401", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/offices`);
  expect(res.status()).toBe(401);
});

test("GET /maps/:officeId/foo.exe rechaza extensión no permitida con 400", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/maps/1/foo.exe`);
  expect(res.status()).toBe(400);
});

test("GET /maps/1/..%2F..%2Fetc%2Fpasswd rechaza path traversal con 400", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/maps/1/..%2F..%2Fetc%2Fpasswd`);
  expect(res.status()).toBe(400);
});

test("GET /maps/1/inexistente.tmj responde 404 si no existe", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/maps/1/map_aaaaaaaaaaaa.tmj`);
  expect([400, 404]).toContain(res.status());
});
