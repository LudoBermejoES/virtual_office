import { describe, it, expect } from "vitest";
import { isLive, generateInviteToken } from "../../../src/domain/invitations.js";

describe("Invitation.isLive", () => {
  it("retorna true si no expirada y no aceptada", () => {
    const now = new Date("2026-04-29T10:00:00.000Z");
    const inv = {
      expires_at: "2026-05-06T10:00:00.000Z",
      accepted_at: null,
    };
    expect(isLive(inv, now)).toBe(true);
  });

  it("retorna false si ya expirada", () => {
    const now = new Date("2026-04-29T10:00:00.000Z");
    const inv = {
      expires_at: "2026-04-28T10:00:00.000Z",
      accepted_at: null,
    };
    expect(isLive(inv, now)).toBe(false);
  });

  it("retorna false si ya aceptada", () => {
    const now = new Date("2026-04-29T10:00:00.000Z");
    const inv = {
      expires_at: "2026-05-06T10:00:00.000Z",
      accepted_at: "2026-04-29T09:00:00.000Z",
    };
    expect(isLive(inv, now)).toBe(false);
  });
});

describe("generateInviteToken", () => {
  it("genera 43 caracteres en base64url (32 bytes)", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("genera tokens únicos en llamadas sucesivas", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateInviteToken());
    expect(tokens.size).toBe(100);
  });
});
