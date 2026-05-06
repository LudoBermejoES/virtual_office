import { addDays } from "@virtual-office/shared";

export interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isOutOfHorizon: boolean;
}

export interface MonthGrid {
  year: number;
  month: number; // 0..11
  weeks: DayCell[][]; // 6 filas × 7 columnas
  prevMonthDisabled: boolean;
  nextMonthDisabled: boolean;
}

export interface Horizon {
  history: number;
  horizon: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoFromYMD(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function dayOfWeekMondayBased(year: number, month: number, day: number): number {
  // 0 = lunes, 6 = domingo
  const dt = new Date(Date.UTC(year, month, day));
  const dow = dt.getUTCDay(); // 0 dom..6 sab
  return (dow + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function buildMonthGrid(
  year: number,
  month: number,
  today: string,
  horizon: Horizon,
): MonthGrid {
  const minIso = addDays(today, -horizon.history);
  const maxIso = addDays(today, horizon.horizon - 1);

  const firstDow = dayOfWeekMondayBased(year, month, 1);
  const startIso =
    firstDow === 0 ? isoFromYMD(year, month, 1) : addDays(isoFromYMD(year, month, 1), -firstDow);

  const weeks: DayCell[][] = [];
  let cursor = startIso;
  for (let row = 0; row < 6; row++) {
    const week: DayCell[] = [];
    for (let col = 0; col < 7; col++) {
      const [cy, cm, cd] = cursor.split("-").map(Number);
      week.push({
        iso: cursor,
        day: cd!,
        inMonth: cy === year && cm! - 1 === month,
        isToday: cursor === today,
        isOutOfHorizon: cursor < minIso || cursor > maxIso,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  const prevMonthDisabled = isMonthFullyOut(year, month, -1, minIso, maxIso);
  const nextMonthDisabled = isMonthFullyOut(year, month, +1, minIso, maxIso);

  return { year, month, weeks, prevMonthDisabled, nextMonthDisabled };
}

function isMonthFullyOut(
  year: number,
  month: number,
  delta: -1 | 1,
  minIso: string,
  maxIso: string,
): boolean {
  let targetYear = year;
  let targetMonth = month + delta;
  if (targetMonth < 0) {
    targetMonth = 11;
    targetYear -= 1;
  } else if (targetMonth > 11) {
    targetMonth = 0;
    targetYear += 1;
  }
  const total = daysInMonth(targetYear, targetMonth);
  const firstIso = isoFromYMD(targetYear, targetMonth, 1);
  const lastIso = isoFromYMD(targetYear, targetMonth, total);
  return lastIso < minIso || firstIso > maxIso;
}
