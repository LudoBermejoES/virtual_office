import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface SessionPayload extends Omit<JWTPayload, "sub"> {
  sub: number;
  role: "admin" | "member";
  kid?: number;
}

const encoder = new TextEncoder();

export async function signJwt(
  payload: Omit<SessionPayload, "iat" | "exp">,
  secret: string,
  ttlDays = 7,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(encoder.encode(secret));
}

export async function verifyJwt(
  token: string,
  currentSecret: string,
  previousSecret?: string,
): Promise<SessionPayload> {
  const secrets = [currentSecret, ...(previousSecret ? [previousSecret] : [])];

  for (const secret of secrets) {
    try {
      const { payload } = await jwtVerify(token, encoder.encode(secret));
      return payload as unknown as SessionPayload;
    } catch {
      // prueba el siguiente
    }
  }

  throw new Error("JWT inválido o expirado");
}
