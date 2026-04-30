/**
 * Flujo e2e completo de reserva: reservar, recargar estado, liberar y verificar.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/auth.js";
import { setupTestOffice } from "../support/office.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

test("reservar A1, verificar persistencia y liberar", async ({ request, context }) => {
  const alice = await loginAs(request, context, { email: "alice-booking@example.com", role: "member" });
  const { officeId, desks } = await setupTestOffice(request);
  const desk = desks[0]!;
  const date = todayIso();

  const bookRes = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, {
    data: { date },
  });
  expect(bookRes.status()).toBe(201);
  const booking = await bookRes.json<{ booking: { date: string; desk_id: number } }>();
  expect(booking.booking.date).toBe(date);
  expect(booking.booking.desk_id).toBe(desk.id);

  const snapRes = await request.get(`${BACKEND}/api/offices/${officeId}?date=${date}`);
  expect(snapRes.status()).toBe(200);
  const snap = await snapRes.json<{ desks: Array<{ id: number; booking: { user_id: number } | null }> }>();
  const deskSnap = snap.desks.find((d) => d.id === desk.id);
  expect(deskSnap?.booking?.user_id).toBe(alice.id);

  const releaseRes = await request.delete(`${BACKEND}/api/desks/${desk.id}/bookings`, {
    data: { date },
  });
  expect(releaseRes.status()).toBe(204);

  const snapAfterRelease = await request.get(`${BACKEND}/api/offices/${officeId}?date=${date}`);
  const snapAfter = await snapAfterRelease.json<{ desks: Array<{ id: number; booking: unknown }> }>();
  const deskAfter = snapAfter.desks.find((d) => d.id === desk.id);
  expect(deskAfter?.booking).toBeNull();
});
