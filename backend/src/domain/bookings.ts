const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: unknown): { ok: true; date: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const match = ISO_DATE_REGEX.exec(value);
  if (!match) return { ok: false };
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false };
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return { ok: false };
  }
  return { ok: true, date: value };
}

export function addDaysIso(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function isInWindow(date: string, today: string, horizonDays: number): boolean {
  return date >= today && date <= addDaysIso(today, horizonDays);
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type DeskState = "free" | "mine" | "occupied" | "fixed";

export interface DeskStateInput {
  desk: { id: number };
  bookings: Array<{ deskId: number; userId: number; type: "daily" | "fixed" }>;
  meId: number;
}

export function deskState(input: DeskStateInput): DeskState {
  const b = input.bookings.find((x) => x.deskId === input.desk.id);
  if (!b) return "free";
  if (b.type === "fixed") return "fixed";
  if (b.userId === input.meId) return "mine";
  return "occupied";
}
