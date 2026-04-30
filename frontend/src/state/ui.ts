import { createStore } from "zustand/vanilla";
import { addDays, todayInTz, withinHorizon } from "@virtual-office/shared";

const STORAGE_KEY = "teimas-space:date";
export const HISTORY_VISIBLE_DAYS = 30;
export const FORWARD_HORIZON_DAYS = 59;

function readInitialDate(now: string): string {
  if (typeof sessionStorage === "undefined") return now;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return now;
  if (!withinHorizon(stored, now, HISTORY_VISIBLE_DAYS, FORWARD_HORIZON_DAYS)) {
    return now;
  }
  return stored;
}

function persist(date: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, date);
}

export interface UiStore {
  selectedDate: string;
  today: string;
  setDate: (d: string) => boolean;
  next: () => void;
  prev: () => void;
  resetToToday: () => void;
  canPrev: () => boolean;
  canNext: () => boolean;
}

export const uiStore = createStore<UiStore>()((set, get) => {
  const now = todayInTz();
  return {
    selectedDate: readInitialDate(now),
    today: now,
    setDate(d: string) {
      const today = get().today;
      if (!withinHorizon(d, today, HISTORY_VISIBLE_DAYS, FORWARD_HORIZON_DAYS)) {
        return false;
      }
      persist(d);
      set({ selectedDate: d });
      return true;
    },
    next() {
      const cur = get().selectedDate;
      const tgt = addDays(cur, 1);
      get().setDate(tgt);
    },
    prev() {
      const cur = get().selectedDate;
      const tgt = addDays(cur, -1);
      get().setDate(tgt);
    },
    resetToToday() {
      const today = get().today;
      get().setDate(today);
    },
    canPrev() {
      const { selectedDate, today } = get();
      return withinHorizon(
        addDays(selectedDate, -1),
        today,
        HISTORY_VISIBLE_DAYS,
        FORWARD_HORIZON_DAYS,
      );
    },
    canNext() {
      const { selectedDate, today } = get();
      return withinHorizon(
        addDays(selectedDate, 1),
        today,
        HISTORY_VISIBLE_DAYS,
        FORWARD_HORIZON_DAYS,
      );
    },
  };
});

/**
 * Filtra los mensajes WS según la fecha seleccionada.
 * desk.booked y desk.released son específicos de fecha;
 * desk.fixed/desk.unfixed/office.updated/snapshot.ts/auth.expired aplican siempre.
 */
import type { WsServerMessage } from "@virtual-office/shared";

export function shouldApply(msg: WsServerMessage, selectedDate: string): boolean {
  if (msg.type === "desk.booked" || msg.type === "desk.released") {
    return msg.date === selectedDate;
  }
  return true;
}
