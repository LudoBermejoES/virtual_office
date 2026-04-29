import { describe, it, expect } from "vitest";
import { isAllowedDomain, checkDomain } from "../../../src/domain/auth.js";

const DOMAINS = ["teimas.com", "teimas.es"];

describe("isAllowedDomain", () => {
  it("admite hd en la allowlist", () => {
    expect(isAllowedDomain("teimas.com", "u@teimas.com", DOMAINS)).toBe(true);
  });

  it("rechaza hd fuera de la allowlist", () => {
    expect(isAllowedDomain("otra.com", "u@otra.com", DOMAINS)).toBe(false);
  });

  it("admite por sufijo de email cuando no hay hd (cuenta Gmail)", () => {
    expect(isAllowedDomain(undefined, "u@teimas.com", DOMAINS)).toBe(true);
  });

  it("rechaza email con dominio fuera de allowlist y sin hd", () => {
    expect(isAllowedDomain(undefined, "u@externa.com", DOMAINS)).toBe(false);
  });

  it("rechaza cuando email es undefined", () => {
    expect(isAllowedDomain("teimas.com", undefined, DOMAINS)).toBe(false);
  });
});

describe("checkDomain", () => {
  const now = new Date("2026-04-29T10:00:00.000Z");
  const future = "2026-05-06T10:00:00.000Z";
  const past = "2026-04-28T10:00:00.000Z";

  it("dominio Teimas → internal", () => {
    const r = checkDomain(
      { hd: "teimas.com", email: "u@teimas.com" },
      DOMAINS,
      undefined,
      null,
      now,
    );
    expect(r).toEqual({ ok: true, reason: "internal" });
  });

  it("externo + invitación viva con email coincidente → invited", () => {
    const inv = {
      id: 7,
      email: "cliente@externo.com",
      token: "tok-123",
      expires_at: future,
      accepted_at: null,
    };
    const r = checkDomain(
      { hd: undefined, email: "cliente@externo.com" },
      DOMAINS,
      "tok-123",
      inv,
      now,
    );
    expect(r).toEqual({ ok: true, reason: "invited", invitationId: 7 });
  });

  it("externo + invitación caducada → invitation_expired", () => {
    const inv = {
      id: 7,
      email: "cliente@externo.com",
      token: "tok-123",
      expires_at: past,
      accepted_at: null,
    };
    const r = checkDomain(
      { hd: undefined, email: "cliente@externo.com" },
      DOMAINS,
      "tok-123",
      inv,
      now,
    );
    expect(r).toEqual({ ok: false, reason: "invitation_expired" });
  });

  it("externo + invitación de otro email → invitation_email_mismatch", () => {
    const inv = {
      id: 7,
      email: "cliente@externo.com",
      token: "tok-123",
      expires_at: future,
      accepted_at: null,
    };
    const r = checkDomain(
      { hd: undefined, email: "attacker@otro.com" },
      DOMAINS,
      "tok-123",
      inv,
      now,
    );
    expect(r).toEqual({ ok: false, reason: "invitation_email_mismatch" });
  });

  it("externo sin token → domain_not_allowed", () => {
    const r = checkDomain(
      { hd: undefined, email: "cliente@externo.com" },
      DOMAINS,
      undefined,
      null,
      now,
    );
    expect(r).toEqual({ ok: false, reason: "domain_not_allowed" });
  });

  it("externo con invitación ya aceptada → invitation_already_used", () => {
    const inv = {
      id: 7,
      email: "cliente@externo.com",
      token: "tok-123",
      expires_at: future,
      accepted_at: "2026-04-28T09:00:00.000Z",
    };
    const r = checkDomain(
      { hd: undefined, email: "cliente@externo.com" },
      DOMAINS,
      "tok-123",
      inv,
      now,
    );
    expect(r).toEqual({ ok: false, reason: "invitation_already_used" });
  });
});
