/**
 * E2E del panel de administración. Sin sesión Google real, validamos que los nuevos
 * endpoints protegen correctamente el acceso y responden con los códigos esperados.
 * Los flujos de UI completos (botón ⚙, overlay) se validan en prueba manual.
 */
import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

// ── GET /api/users ────────────────────────────────────────────────────────────

test("GET /api/users sin sesión devuelve 401", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/users`);
  expect(res.status()).toBe(401);
});

test("GET /api/users?email= sin sesión devuelve 401", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/users?email=admin@teimas.com`);
  expect(res.status()).toBe(401);
});

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────

test("PATCH /api/users/1 sin sesión devuelve 401", async ({ request }) => {
  const res = await request.patch(`${BACKEND_BASE}/api/users/1`, {
    data: { role: "admin" },
  });
  expect(res.status()).toBe(401);
});

// ── POST /api/invitations/:id/renew ──────────────────────────────────────────

test("POST /api/invitations/1/renew sin sesión devuelve 401", async ({ request }) => {
  const res = await request.post(`${BACKEND_BASE}/api/invitations/1/renew`);
  expect(res.status()).toBe(401);
});

// ── GET /api/offices/:id/admins ───────────────────────────────────────────────

test("GET /api/offices/1/admins sin sesión devuelve 401", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/offices/1/admins`);
  expect(res.status()).toBe(401);
});

// ── GET /api/offices/:id/fixed-assignments ────────────────────────────────────

test("GET /api/offices/1/fixed-assignments sin sesión devuelve 401", async ({ request }) => {
  const res = await request.get(`${BACKEND_BASE}/api/offices/1/fixed-assignments`);
  expect(res.status()).toBe(401);
});

// ── Flujos con sesión de admin (TEST_AUTH=on) ─────────────────────────────────

test("admin puede listar usuarios", async ({ request }) => {
  const loginRes = await request.post(`${BACKEND_BASE}/api/test/session`, {
    data: { email: "e2e-admin@teimas.com", role: "admin" },
  });
  expect(loginRes.status()).toBe(200);

  const res = await request.get(`${BACKEND_BASE}/api/users`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test("member recibe 403 al listar usuarios", async ({ request }) => {
  await request.post(`${BACKEND_BASE}/api/test/session`, {
    data: { email: "e2e-member-users@teimas.com", role: "member" },
  });

  const res = await request.get(`${BACKEND_BASE}/api/users`);
  expect(res.status()).toBe(403);
});

test("admin puede renovar una invitación", async ({ request }) => {
  await request.post(`${BACKEND_BASE}/api/test/session`, {
    data: { email: "e2e-admin2@teimas.com", role: "admin" },
  });

  // Crear invitación
  const createRes = await request.post(`${BACKEND_BASE}/api/invitations`, {
    data: { email: "e2e-renew-target@external.com" },
  });
  expect(createRes.status()).toBe(201);
  const inv = await createRes.json() as { id: number; token: string };

  // Renovar
  const renewRes = await request.post(`${BACKEND_BASE}/api/invitations/${inv.id}/renew`);
  expect(renewRes.status()).toBe(200);
  const updated = (await renewRes.json() as { invitation: { token: string; accepted_at: null } }).invitation;
  expect(updated.token).not.toBe(inv.token);
  expect(updated.accepted_at).toBeNull();
});

test("GET /api/offices/999/fixed-assignments con admin no devuelve 401 ni 403", async ({ request }) => {
  await request.post(`${BACKEND_BASE}/api/test/session`, {
    data: { email: "e2e-admin3@teimas.com", role: "admin" },
  });

  const res = await request.get(`${BACKEND_BASE}/api/offices/999/fixed-assignments`);
  // Admin autenticado: no debe recibir error de autenticación/autorización
  expect([200, 404]).toContain(res.status());
});
