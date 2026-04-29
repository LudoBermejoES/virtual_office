import { describe, it, expect, vi, afterEach } from "vitest";

describe("env — validación de variables de entorno", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("termina el proceso si falta SESSION_SECRET", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit llamado");
    }) as never);

    await expect(import("../../../src/config/env.js")).rejects.toThrow("process.exit llamado");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it("carga correctamente cuando SESSION_SECRET está presente", async () => {
    vi.stubEnv("SESSION_SECRET", "supersecretodealmenos32caracteresaqui");
    vi.stubEnv("NODE_ENV", "test");

    const { env } = await import("../../../src/config/env.js");
    expect(env.SESSION_SECRET).toBe("supersecretodealmenos32caracteresaqui");
    expect(env.NODE_ENV).toBe("test");
  });
});
