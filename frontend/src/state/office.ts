import { createStore } from "zustand/vanilla";
import type { OfficeFeaturesPayload, NpcData } from "@virtual-office/shared";

export type { OfficeFeaturesPayload, NpcData };

export interface Desk {
  id: number;
  label: string;
  x: number;
  y: number;
  source: "manual" | "tiled";
}

export interface BookingDto {
  id: number;
  deskId: number;
  userId: number;
  type: "daily" | "fixed";
  date: string;
  user: { id: number; name: string; avatar_url: string | null };
}

export interface OfficeDetail {
  office: {
    id: number;
    name: string;
    tmj_filename: string;
    tile_width: number;
    tile_height: number;
    map_width: number;
    map_height: number;
    cells_x: number;
    cells_y: number;
  };
  tilesets: Array<{
    ordinal: number;
    image_name: string;
    filename: string;
    animations?: unknown[];
  }>;
  desks: Desk[];
  bookings: BookingDto[];
  date: string;
  features: OfficeFeaturesPayload;
  npcs: NpcData[];
}

export interface OfficeStore {
  detail: OfficeDetail | null;
  bookingsByKey: Map<string, BookingDto>;
  setDetail: (d: OfficeDetail) => void;
  clear: () => void;
}

function indexBookings(bookings: BookingDto[]): Map<string, BookingDto> {
  const map = new Map<string, BookingDto>();
  for (const b of bookings) {
    map.set(`${b.deskId}:${b.date}`, b);
  }
  return map;
}

export const officeStore = createStore<OfficeStore>()((set) => ({
  detail: null,
  bookingsByKey: new Map(),
  setDetail: (d: OfficeDetail) => set({ detail: d, bookingsByKey: indexBookings(d.bookings) }),
  clear: () => set({ detail: null, bookingsByKey: new Map() }),
}));
