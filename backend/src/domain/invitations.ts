import { randomBytes } from "node:crypto";

export interface InvitationLifecycleFields {
  expires_at: string;
  accepted_at: string | null;
}

export function isLive(inv: InvitationLifecycleFields, now: Date): boolean {
  if (inv.accepted_at !== null) return false;
  return new Date(inv.expires_at).getTime() > now.getTime();
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}
