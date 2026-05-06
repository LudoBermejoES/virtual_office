import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/cli.js";

describe("parseArgs", () => {
  it("acepta input-dir y output.png", () => {
    const a = parseArgs(["dir", "out.png"]);
    expect(a.inputDir).toBe("dir");
    expect(a.outputImage).toBe("out.png");
    expect(a.tile).toBe(48);
    expect(a.duration).toBe(200);
  });

  it("--tile y --duration", () => {
    const a = parseArgs(["dir", "out.png", "--tile", "32", "--duration", "100"]);
    expect(a.tile).toBe(32);
    expect(a.duration).toBe(100);
  });

  it("--webp --recursive", () => {
    const a = parseArgs(["dir", "out.png", "--webp", "--recursive"]);
    expect(a.webp).toBe(true);
    expect(a.recursive).toBe(true);
  });

  it("--help", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  it("falla con flag desconocida", () => {
    expect(() => parseArgs(["dir", "out.png", "--xxx"])).toThrow(/unknown_flag/);
  });

  it("falla con tile no numérico", () => {
    expect(() => parseArgs(["dir", "out.png", "--tile", "abc"])).toThrow(/invalid_tile/);
  });
});
