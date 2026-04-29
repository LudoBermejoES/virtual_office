import type { GooglePayload } from "../../src/infra/auth/google-verifier.js";

export type { GooglePayload };

export class FakeGoogleVerifier {
  private next: (GooglePayload & { email_verified?: boolean }) | null = null;

  setNextPayload(payload: GooglePayload & { email_verified?: boolean }): void {
    this.next = payload;
  }

  async verify(_token: string): Promise<GooglePayload & { email_verified?: boolean }> {
    if (!this.next) {
      throw new Error("FakeGoogleVerifier: el test no llamó a setNextPayload antes de verify");
    }
    const payload = this.next;
    this.next = null;
    return payload;
  }
}
