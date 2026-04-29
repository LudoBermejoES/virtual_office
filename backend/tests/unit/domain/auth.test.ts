import { describe, it, expect } from "vitest";
import { isAllowedDomain } from "../../../src/domain/auth.js";

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
