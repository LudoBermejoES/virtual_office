import { uiStore, HISTORY_VISIBLE_DAYS, FORWARD_HORIZON_DAYS } from "../state/ui.js";
import { buildMonthGrid, type DayCell, type MonthGrid } from "./day-picker-grid.js";

const MONTH_NAMES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

const WEEKDAY_NAMES = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];

let panelEl: HTMLDivElement | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let viewYear = 0;
let viewMonth = 0;

export function isDayPickerOpen(): boolean {
  return panelEl != null;
}

export interface MountAnchor {
  x: number;
  y: number;
}

export function mountDayPicker(anchor?: MountAnchor): void {
  if (panelEl) return;

  const { selectedDate } = uiStore.getState();
  const [sy, sm] = selectedDate.split("-").map(Number);
  viewYear = sy!;
  viewMonth = sm! - 1;

  const overlay = document.createElement("div");
  overlay.id = "day-picker";
  overlay.className = "day-picker";
  panelEl = overlay;

  if (anchor) {
    overlay.style.left = `${anchor.x}px`;
    overlay.style.top = `${anchor.y}px`;
    overlay.style.transform = "translateX(-50%)";
  } else {
    overlay.style.left = "50%";
    overlay.style.top = "60px";
    overlay.style.transform = "translateX(-50%)";
  }

  rerender();
  document.body.appendChild(overlay);

  outsideClickHandler = (e: MouseEvent) => {
    if (!panelEl) return;
    const target = e.target as Node | null;
    if (target && panelEl.contains(target)) return;
    unmountDayPicker();
  };
  escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      unmountDayPicker();
    }
  };
  document.addEventListener("mousedown", outsideClickHandler, true);
  document.addEventListener("keydown", escHandler);
}

export function unmountDayPicker(): void {
  if (outsideClickHandler) {
    document.removeEventListener("mousedown", outsideClickHandler, true);
    outsideClickHandler = null;
  }
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
  panelEl?.remove();
  panelEl = null;
}

function rerender(): void {
  if (!panelEl) return;
  panelEl.innerHTML = "";

  const { today, selectedDate } = uiStore.getState();
  const grid = buildMonthGrid(viewYear, viewMonth, today, {
    history: HISTORY_VISIBLE_DAYS,
    horizon: FORWARD_HORIZON_DAYS + 1,
  });

  panelEl.appendChild(buildHeader(grid));
  panelEl.appendChild(buildWeekdayRow());
  panelEl.appendChild(buildGrid(grid, selectedDate));
}

function buildHeader(grid: MonthGrid): HTMLElement {
  const header = document.createElement("div");
  header.className = "day-picker__header";

  const prev = document.createElement("button");
  prev.className = "day-picker__nav";
  prev.textContent = "<";
  prev.disabled = grid.prevMonthDisabled;
  prev.dataset["nav"] = "prev";
  prev.addEventListener("click", () => {
    if (grid.prevMonthDisabled) return;
    if (viewMonth === 0) {
      viewMonth = 11;
      viewYear -= 1;
    } else {
      viewMonth -= 1;
    }
    rerender();
  });

  const title = document.createElement("span");
  title.className = "day-picker__title";
  title.textContent = `${MONTH_NAMES[grid.month]} ${grid.year}`;

  const next = document.createElement("button");
  next.className = "day-picker__nav";
  next.textContent = ">";
  next.disabled = grid.nextMonthDisabled;
  next.dataset["nav"] = "next";
  next.addEventListener("click", () => {
    if (grid.nextMonthDisabled) return;
    if (viewMonth === 11) {
      viewMonth = 0;
      viewYear += 1;
    } else {
      viewMonth += 1;
    }
    rerender();
  });

  header.appendChild(prev);
  header.appendChild(title);
  header.appendChild(next);
  return header;
}

function buildWeekdayRow(): HTMLElement {
  const row = document.createElement("div");
  row.className = "day-picker__weekdays";
  for (const name of WEEKDAY_NAMES) {
    const el = document.createElement("span");
    el.className = "day-picker__weekday";
    el.textContent = name;
    row.appendChild(el);
  }
  return row;
}

function buildGrid(grid: MonthGrid, selectedIso: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "day-picker__grid";
  for (const week of grid.weeks) {
    for (const cell of week) {
      wrap.appendChild(buildCell(cell, selectedIso));
    }
  }
  return wrap;
}

function buildCell(cell: DayCell, selectedIso: string): HTMLElement {
  const el = document.createElement("button");
  el.className = "day-picker__cell";
  el.textContent = String(cell.day);
  el.dataset["iso"] = cell.iso;
  if (!cell.inMonth) el.classList.add("day-picker__cell--out-of-month");
  if (cell.isToday) el.classList.add("day-picker__cell--today");
  if (cell.iso === selectedIso) el.classList.add("day-picker__cell--selected");
  if (cell.isOutOfHorizon) {
    el.classList.add("day-picker__cell--out");
    el.disabled = true;
  } else {
    el.addEventListener("click", () => {
      uiStore.getState().setDate(cell.iso);
      unmountDayPicker();
    });
  }
  return el;
}
