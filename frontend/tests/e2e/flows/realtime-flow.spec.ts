/**
 * Flujo e2e realtime: Alice reserva y Bob ve el cambio via snapshot actualizado.
 * El canal WebSocket requiere frontend activo; este test valida la sincronización
 * a nivel de API (el snapshot se actualiza inmediatamente tras la reserva).
 */
import { test, expect, chromium } from "@playwright/test";
import { loginAs } from "../support/auth.js";
import { setupTestOffice } from "../support/office.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

test("Alice reserva y Bob ve el cambio en el snapshot", async ({ request, context, browser }) => {
  await loginAs(request, context, { email: "alice-rt@example.com", role: "member" });
  const { officeId, desks } = await setupTestOffice(request);
  const desk = desks[0]!;
  const date = todayIso();

  const bobContext = await browser.newContext();
  const bobRequest = bobContext.request;
  const bobUser = await loginAs(bobRequest, bobContext, { email: "bob-rt@example.com", role: "member" });

  const snapBefore = await bobRequest.get(`${BACKEND}/api/offices/${officeId}?date=${date}`);
  expect(snapBefore.status()).toBe(200);
  const beforeData = await snapBefore.json<{ desks: Array<{ id: number; booking: unknown }> }>();
  const deskBefore = beforeData.desks.find((d) => d.id === desk.id);
  expect(deskBefore?.booking).toBeNull();

  const bookRes = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, { data: { date } });
  expect(bookRes.status()).toBe(201);

  const snapAfter = await bobRequest.get(`${BACKEND}/api/offices/${officeId}?date=${date}`);
  expect(snapAfter.status()).toBe(200);
  const afterData = await snapAfter.json<{ desks: Array<{ id: number; booking: { user_id: number } | null }> }>();
  const deskAfter = afterData.desks.find((d) => d.id === desk.id);
  expect(deskAfter?.booking).not.toBeNull();
  expect(typeof bobUser.id).toBe("number");

  await bobContext.close();
});
