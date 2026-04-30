/**
 * Flujo e2e realtime: Alice reserva y Bob consulta el snapshot actualizado.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/auth.js";
import { setupTestOffice } from "../support/office.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Snapshot = {
  bookings: Array<{ deskId: number; userId: number }>;
};

test("Alice reserva y Bob ve el cambio en el snapshot", async ({ request, context, browser }) => {
  await loginAs(request, context, { email: "alice-rt@example.com", role: "member" });
  const { officeId, desks } = await setupTestOffice(request);
  const desk = desks[0]!;
  const date = todayIso();

  const bobContext = await browser.newContext();
  const bobRequest = bobContext.request;
  await loginAs(bobRequest, bobContext, { email: "bob-rt@example.com", role: "member" });

  const snapBefore = await bobRequest.get(`${BACKEND}/api/offices/${officeId}?date=${date}`);
  expect(snapBefore.status()).toBe(200);
  const beforeData = await snapBefore.json() as Snapshot;
  const bookingBefore = beforeData.bookings.find((b) => b.deskId === desk.id);
  expect(bookingBefore).toBeUndefined();

  const bookRes = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, { data: { date } });
  expect(bookRes.status()).toBe(201);

  const snapAfter = await bobRequest.get(`${BACKEND}/api/offices/${officeId}?date=${date}`);
  expect(snapAfter.status()).toBe(200);
  const afterData = await snapAfter.json() as Snapshot;
  const bookingAfter = afterData.bookings.find((b) => b.deskId === desk.id);
  expect(bookingAfter).toBeDefined();

  await bobContext.close();
});
