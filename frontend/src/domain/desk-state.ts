export type DeskState = "free" | "mine" | "occupied" | "fixed";

export interface BookingLike {
  deskId: number;
  userId: number;
  type: "daily" | "fixed";
}

export function deskState(
  desk: { id: number },
  bookings: ReadonlyArray<BookingLike>,
  meId: number,
): DeskState {
  const b = bookings.find((x) => x.deskId === desk.id);
  if (!b) return "free";
  if (b.type === "fixed") return "fixed";
  if (b.userId === meId) return "mine";
  return "occupied";
}
