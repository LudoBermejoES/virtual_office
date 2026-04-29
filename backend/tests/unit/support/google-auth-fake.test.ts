import { describe, it, expect } from "vitest";
import { FakeGoogleVerifier } from "../../support/google-auth-fake.js";

describe("FakeGoogleVerifier", () => {
  it("lanza error si no se llamó a setNextPayload", async () => {
    const verifier = new FakeGoogleVerifier();
    await expect(verifier.verifyIdToken("any-token")).rejects.toThrow(
      "el test no llamó a setNextPayload",
    );
  });

  it("devuelve el payload configurado y lo consume", async () => {
    const verifier = new FakeGoogleVerifier();
    const payload = {
      sub: "12345",
      email: "alice@teimas.com",
      hd: "teimas.com",
      name: "Alice",
    };
    verifier.setNextPayload(payload);

    const result = await verifier.verifyIdToken("fake-token");
    expect(result.getPayload()).toEqual(payload);

    await expect(verifier.verifyIdToken("another-token")).rejects.toThrow(
      "el test no llamó a setNextPayload",
    );
  });
});
