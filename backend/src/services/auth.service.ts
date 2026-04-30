import type { DatabaseSync } from "node:sqlite";

export interface SessionUser {
  id: number;
  role: "admin" | "member";
}

export function canAdminOffice(user: SessionUser, officeId: number, db: DatabaseSync): boolean {
  if (user.role === "admin") return true;
  const row = db
    .prepare("SELECT 1 FROM office_admins WHERE office_id = ? AND user_id = ?")
    .get(officeId, user.id);
  return !!row;
}
