import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../../../../src/infra/auth/session.js";

const SECRET = "test-secret-con-almenos-32-caracteres-aqui";
const PREV = "previous-secret-con-almenos-32-car";

describe("signJwt / verifyJwt", () => {
  it("verifica un token recién firmado", async () => {
    const token = await signJwt({ sub: 1, role: "member" }, SECRET);
    const payload = await verifyJwt(token, SECRET);
    expect(payload.sub).toBe(1);
    expect(payload.role).toBe("member");
  });

  it("rechaza token firmado con secret desconocido", async () => {
    const token = await signJwt({ sub: 1, role: "member" }, "otro-secret-de-al-menos-32-chars!");
    await expect(verifyJwt(token, SECRET)).rejects.toThrow();
  });

  it("JWT firmado con secret previous se acepta cuando current ya rotó", async () => {
    const token = await signJwt({ sub: 2, role: "admin" }, PREV);
    const payload = await verifyJwt(token, SECRET, PREV);
    expect(payload.sub).toBe(2);
    expect(payload.role).toBe("admin");
  });

  it("rechaza token expirado aunque el secret sea correcto", async () => {
    const token = await signJwt({ sub: 3, role: "member" }, SECRET, -1);
    await expect(verifyJwt(token, SECRET)).rejects.toThrow();
  });
});
