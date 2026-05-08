export type DeskState = "free" | "mine" | "occupied" | "fixed";

export interface BookingLike {
  deskId: number;
  userId: number;
  /** "weekly" se proyecta desde weekly_assignments (change 027). Para
   * cómputo de DeskState se trata como occupied/mine; el flujo específico
   * (modal del change 028) se ramifica desde `OfficeScene.handleDeskClick`
   * leyendo el campo `type` directamente. */
  type: "daily" | "fixed" | "weekly";
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
