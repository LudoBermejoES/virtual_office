/**
 * Flujo e2e de asignación fija: admin asigna fijo, miembro sin admin recibe 403.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/auth.js";
import { setupTestOffice } from "../support/office.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

test("admin asigna fijo correctamente", async ({ request, context }) => {
  const admin = await loginAs(request, context, { email: "admin-fixed@example.com", role: "admin" });
  const { desks } = await setupTestOffice(request);
  const desk = desks[0]!;

  const res = await request.post(`${BACKEND}/api/desks/${desk.id}/fixed`, {
    data: { userId: admin.id },
  });
  expect(res.status()).toBe(201);
  const body = await res.json<{ fixed: { desk_id: number; user_id: number } }>();
  expect(body.fixed.desk_id).toBe(desk.id);
  expect(body.fixed.user_id).toBe(admin.id);
});

test("miembro no admin recibe 403 al asignar fijo", async ({ request, context, browser }) => {
  const adminContext = await browser.newContext();
  const adminRequest = adminContext.request;
  const admin = await loginAs(adminRequest, adminContext, {
    email: "admin-fixed2@example.com",
    role: "admin",
  });
  const { desks } = await setupTestOffice(adminRequest);
  const desk = desks[0]!;

  const memberContext = context;
  await loginAs(request, memberContext, { email: "member-fixed@example.com", role: "member" });

  const res = await request.post(`${BACKEND}/api/desks/${desk.id}/fixed`, {
    data: { userId: admin.id },
  });
  expect(res.status()).toBe(403);

  await adminContext.close();
});
