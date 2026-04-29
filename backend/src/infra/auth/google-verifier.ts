import { OAuth2Client } from "google-auth-library";

export interface GooglePayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  hd?: string;
  name: string;
  picture?: string;
  iss: string;
}

export class GoogleVerifier {
  private client: OAuth2Client;

  constructor(private clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<GooglePayload> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Token payload vacío");
    return payload as GooglePayload;
  }
}
