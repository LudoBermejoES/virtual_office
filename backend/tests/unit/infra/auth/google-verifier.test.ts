import { describe, it, expect } from "vitest";
import { GoogleVerifier } from "../../../../src/infra/auth/google-verifier.js";

describe("GoogleVerifier", () => {
  it("rechaza token con audience incorrecto", async () => {
    const verifier = new GoogleVerifier("expected-client-id");
    await expect(verifier.verify("not-a-real-token")).rejects.toThrow();
  });
});
