import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/cli.js";

describe("parseArgs", () => {
  it("acepta input-dir y output.png (infiere modo atlas)", () => {
    const a = parseArgs(["dir", "out.png"]);
    expect(a.inputDir).toBe("dir");
    expect(a.output).toBe("out.png");
    expect(a.tile).toBe(48);
    expect(a.duration).toBe(200);
    expect(a.forceMode).toBe("atlas");
  });

  it("output .tsx infiere modo collection", () => {
    const a = parseArgs(["dir", "out.tsx"]);
    expect(a.forceMode).toBe("collection");
  });

  it("output sin extensión no infiere modo (autodetect)", () => {
    const a = parseArgs(["dir", "out"]);
    expect(a.forceMode).toBeUndefined();
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

  it("--collection y --atlas se mapean a forceMode", () => {
    expect(parseArgs(["dir", "out", "--collection"]).forceMode).toBe("collection");
    expect(parseArgs(["dir", "out", "--atlas"]).forceMode).toBe("atlas");
  });

  it("--frame-sizes acepta path", () => {
    const a = parseArgs(["dir", "out", "--frame-sizes", "/tmp/m.json"]);
    expect(a.frameSizesPath).toBe("/tmp/m.json");
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
