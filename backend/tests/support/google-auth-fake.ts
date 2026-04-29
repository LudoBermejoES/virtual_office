export interface GooglePayload {
  sub: string;
  email: string;
  hd?: string;
  name: string;
  picture?: string;
}

export class FakeGoogleVerifier {
  private next: GooglePayload | null = null;

  setNextPayload(payload: GooglePayload): void {
    this.next = payload;
  }

  async verifyIdToken(_token: string): Promise<{ getPayload: () => GooglePayload }> {
    if (!this.next) {
      throw new Error("FakeGoogleVerifier: el test no llamó a setNextPayload antes de verifyIdToken");
    }
    const payload = this.next;
    this.next = null;
    return { getPayload: () => payload };
  }
}
