/**
 * Flujo e2e de bloqueo de puestos con placeholders "Bloqueado #N"
 * (change 031): un admin bloquea un puesto, el member lo ve ocupado y no
 * puede reservarlo, y el admin lo desbloquea.
 *
 * Como el mapa vive en un canvas de Phaser no consultable desde Playwright,
 * el flujo se ejerce a nivel de API igual que el resto de specs de `flows/`.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/auth.js";
import { setupTestOffice } from "../support/office.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type PlaceholderUser = { id: number; name: string; is_placeholder: number };
type Snapshot = {
  bookings: Array<{ deskId: number; userId: number; type: string; user: { name: string } }>;
};

test("admin bloquea un puesto con Bloqueado #1 y luego lo desbloquea", async ({
  request,
  context,
}) => {
  await loginAs(request, context, { email: "admin-block@example.com", role: "admin" });
  const { officeId, desks } = await setupTestOffice(request);
  const desk = desks[0]!;
  const date = todayIso();

  // El admin ve los placeholders al pedirlos explícitamente.
  const usersRes = await request.get(`${BACKEND}/api/users?includePlaceholders=1`);
  expect(usersRes.status()).toBe(200);
  const users = (await usersRes.json()) as PlaceholderUser[];
  const placeholders = users.filter((u) => u.is_placeholder === 1);
  expect(placeholders.map((p) => p.name)).toEqual([
    "Bloqueado #1",
    "Bloqueado #2",
    "Bloqueado #3",
  ]);

  // Sin el flag no aparecen (no se mezclan con personas en la UI).
  const plainRes = await request.get(`${BACKEND}/api/users`);
  const plain = (await plainRes.json()) as PlaceholderUser[];
  expect(plain.some((u) => u.is_placeholder === 1)).toBe(false);

  // Bloquear = reservar a nombre del placeholder, con el endpoint de siempre.
  const blockRes = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, {
    data: { date, userId: placeholders[0]!.id },
  });
  expect(blockRes.status()).toBe(201);

  const snap = (await (
    await request.get(`${BACKEND}/api/offices/${officeId}?date=${date}`)
  ).json()) as Snapshot;
  const blocked = snap.bookings.find((b) => b.deskId === desk.id);
  expect(blocked?.userId).toBe(placeholders[0]!.id);
  expect(blocked?.type).toBe("daily");
  expect(blocked?.user.name).toBe("Bloqueado #1");

  // Desbloquear.
  const unblockRes = await request.delete(`${BACKEND}/api/desks/${desk.id}/bookings`, {
    data: { date, userId: placeholders[0]!.id },
  });
  expect(unblockRes.status()).toBe(204);

  const snapAfter = (await (
    await request.get(`${BACKEND}/api/offices/${officeId}?date=${date}`)
  ).json()) as Snapshot;
  expect(snapAfter.bookings.find((b) => b.deskId === desk.id)).toBeUndefined();
});

test("un member ve el puesto bloqueado como ocupado y no puede reservarlo", async ({
  request,
  context,
}) => {
  // Primero el admin bloquea.
  await loginAs(request, context, { email: "admin-block2@example.com", role: "admin" });
  const { officeId, desks } = await setupTestOffice(request);
  const desk = desks[0]!;
  const date = todayIso();

  const users = (await (
    await request.get(`${BACKEND}/api/users?includePlaceholders=1`)
  ).json()) as PlaceholderUser[];
  const ph = users.find((u) => u.is_placeholder === 1)!;
  const blockRes = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, {
    data: { date, userId: ph.id },
  });
  expect(blockRes.status()).toBe(201);

  // Ahora un member: ve el puesto ocupado por "Bloqueado #1"...
  await loginAs(request, context, { email: "member-block@example.com", role: "member" });
  const snap = (await (
    await request.get(`${BACKEND}/api/offices/${officeId}?date=${date}`)
  ).json()) as Snapshot;
  expect(snap.bookings.find((b) => b.deskId === desk.id)?.user.name).toBe("Bloqueado #1");

  // ...y no puede reservarlo.
  const attempt = await request.post(`${BACKEND}/api/desks/${desk.id}/bookings`, { data: { date } });
  expect(attempt.status()).toBe(409);
  expect((await attempt.json()) as { reason: string }).toEqual({ reason: "desk_already_booked" });

  // Tampoco puede bloquear él mismo (mandar userId siendo member → 403).
  const forbidden = await request.post(`${BACKEND}/api/desks/${desks[1]!.id}/bookings`, {
    data: { date, userId: ph.id },
  });
  expect(forbidden.status()).toBe(403);
});
