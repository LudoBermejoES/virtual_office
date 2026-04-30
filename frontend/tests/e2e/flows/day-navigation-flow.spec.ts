/**
 * Flujo e2e de navegación por días: reservar en día +1, verificar que no
 * aparece en hoy, y que sí aparece al consultar +1.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/auth.js";
import { setupTestOffice } from "../support/office.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test("reserva en día +1 no aparece en hoy, sí en +1", async ({ request, context }) => {
  const alice = await loginAs(request, context, { email: "alice-daynav@example.com", role: "member" });
  const { officeId, desks } = await setupTestOffice(request);
  const desk = desks[0]!;

  const today = todayIso();
  const tomorrow = addDays(today, 1);

  const bookRes = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, {
    data: { date: tomorrow },
  });
  expect(bookRes.status()).toBe(201);

  const snapToday = await request.get(`${BACKEND}/api/offices/${officeId}?date=${today}`);
  expect(snapToday.status()).toBe(200);
  const todayData = await snapToday.json<{ desks: Array<{ id: number; booking: unknown }> }>();
  const deskToday = todayData.desks.find((d) => d.id === desk.id);
  expect(deskToday?.booking).toBeNull();

  const snapTomorrow = await request.get(`${BACKEND}/api/offices/${officeId}?date=${tomorrow}`);
  expect(snapTomorrow.status()).toBe(200);
  const tomorrowData = await snapTomorrow.json<{ desks: Array<{ id: number; booking: { user_id: number } | null }> }>();
  const deskTomorrow = tomorrowData.desks.find((d) => d.id === desk.id);
  expect(deskTomorrow?.booking?.user_id).toBe(alice.id);
});
