export type UserRole = "admin" | "member";

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
}

export type WsMessage =
  | { type: "desk.booked"; deskId: number; date: string; user: PublicUser }
  | { type: "desk.released"; deskId: number; date: string }
  | { type: "desk.fixed"; deskId: number; user: PublicUser }
  | { type: "desk.unfixed"; deskId: number }
  | { type: "office.updated"; officeId: number };
