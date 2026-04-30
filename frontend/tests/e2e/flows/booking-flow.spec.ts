/**
 * Flujo e2e completo de reserva: reservar, verificar persistencia y liberar.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/auth.js";
import { setupTestOffice } from "../support/office.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Booking = { deskId: number; userId: number };
type Snapshot = { bookings: Booking[] };

test("reservar A1, verificar persistencia y liberar", async ({ request, context }) => {
  const alice = await loginAs(request, context, { email: "alice-booking@example.com", role: "member" });
  const { officeId, desks } = await setupTestOffice(request);
  const desk = desks[0]!;
  const date = todayIso();

  const bookRes = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, { data: { date } });
  expect(bookRes.status()).toBe(201);
  const bookingBody = await bookRes.json() as { booking: { date: string; desk_id: number } };
  expect(bookingBody.booking.date).toBe(date);
  expect(bookingBody.booking.desk_id).toBe(desk.id);

  const snapRes = await request.get(`${BACKEND}/api/offices/${officeId}?date=${date}`);
  expect(snapRes.status()).toBe(200);
  const snap = await snapRes.json() as Snapshot;
  const deskBooking = snap.bookings.find((b) => b.deskId === desk.id);
  expect(deskBooking?.userId).toBe(alice.id);

  const releaseRes = await request.delete(`${BACKEND}/api/desks/${desk.id}/bookings`, { data: { date } });
  expect(releaseRes.status()).toBe(204);

  const snapAfter = await (await request.get(`${BACKEND}/api/offices/${officeId}?date=${date}`)).json() as Snapshot;
  const bookingAfter = snapAfter.bookings.find((b) => b.deskId === desk.id);
  expect(bookingAfter).toBeUndefined();
});
