import { createStore } from "zustand/vanilla";
import type { OfficeSummary } from "@virtual-office/shared";

export interface MeInfo {
  id: number;
  role: "admin" | "member";
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface OfficesStore {
  list: OfficeSummary[];
  meId: number;
  meRole: "admin" | "member";
  meName: string;
  meEmail: string;
  meAvatarUrl: string | null;
  setList: (list: OfficeSummary[], me: MeInfo) => void;
}

export const officesStore = createStore<OfficesStore>()((set) => ({
  list: [],
  meId: 0,
  meRole: "member",
  meName: "",
  meEmail: "",
  meAvatarUrl: null,
  setList: (list, me) =>
    set({ list, meId: me.id, meRole: me.role, meName: me.name, meEmail: me.email, meAvatarUrl: me.avatarUrl }),
}));

export const VO_LAST_OFFICE_KEY = "vo_last_office";

export function pickOfficeId(
  offices: OfficeSummary[],
  serverDefault: number | null,
): number | null {
  if (offices.length === 0) return null;
  if (serverDefault != null && offices.find((o) => o.id === serverDefault)) return serverDefault;
  const stored = localStorage.getItem(VO_LAST_OFFICE_KEY);
  if (stored) {
    const id = parseInt(stored, 10);
    if (!isNaN(id) && offices.find((o) => o.id === id)) return id;
  }
  const adminOffice = offices.find((o) => o.is_admin);
  if (adminOffice) return adminOffice.id;
  return offices[0]!.id;
}
