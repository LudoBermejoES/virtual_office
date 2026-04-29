export function isAllowedDomain(
  hd: string | undefined,
  email: string | undefined,
  allowedDomains: string[],
): boolean {
  if (!email) return false;
  if (hd && allowedDomains.includes(hd)) return true;
  const domain = email.split("@")[1];
  if (!domain) return false;
  return allowedDomains.includes(domain);
}

export type DomainCheck =
  | { ok: true; reason: "internal" }
  | { ok: true; reason: "invited"; invitationId: number }
  | { ok: false; reason: "domain_not_allowed" }
  | { ok: false; reason: "invitation_expired" }
  | { ok: false; reason: "invitation_already_used" }
  | { ok: false; reason: "invitation_email_mismatch" };

export interface InvitationLookup {
  id: number;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
}

export function checkDomain(
  payload: { hd: string | undefined; email: string },
  allowedDomains: string[],
  inviteToken: string | undefined,
  invitationByToken: InvitationLookup | null,
  now: Date,
): DomainCheck {
  if (isAllowedDomain(payload.hd, payload.email, allowedDomains)) {
    return { ok: true, reason: "internal" };
  }

  if (!inviteToken) return { ok: false, reason: "domain_not_allowed" };
  if (!invitationByToken) return { ok: false, reason: "domain_not_allowed" };

  if (invitationByToken.email.toLowerCase() !== payload.email.toLowerCase()) {
    return { ok: false, reason: "invitation_email_mismatch" };
  }
  if (invitationByToken.accepted_at !== null) {
    return { ok: false, reason: "invitation_already_used" };
  }
  if (new Date(invitationByToken.expires_at).getTime() <= now.getTime()) {
    return { ok: false, reason: "invitation_expired" };
  }

  return { ok: true, reason: "invited", invitationId: invitationByToken.id };
}
