import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/cli.js";

describe("parseArgs", () => {
  it("reconoce input y flags por defecto", () => {
    const a = parseArgs(["map.tmj"]);
    expect(a.input).toBe("map.tmj");
    expect(a.padding).toBe(0);
    expect(a.lossless).toBe(true);
    expect(a.quality).toBe(90);
  });

  it("reconoce --out-dir", () => {
    const a = parseArgs(["map.tmj", "--out-dir", "out"]);
    expect(a.outDir).toBe("out");
  });

  it("reconoce --padding", () => {
    const a = parseArgs(["map.tmj", "--padding", "2"]);
    expect(a.padding).toBe(2);
  });

  it("reconoce --lossy --quality", () => {
    const a = parseArgs(["map.tmj", "--lossy", "--quality", "75"]);
    expect(a.lossless).toBe(false);
    expect(a.quality).toBe(75);
  });

  it("--help", () => {
    const a = parseArgs(["--help"]);
    expect(a.help).toBe(true);
  });

  it("--version", () => {
    const a = parseArgs(["-v"]);
    expect(a.version).toBe(true);
  });

  it("falla con flag desconocida", () => {
    expect(() => parseArgs(["map.tmj", "--unknown"])).toThrow(/unknown_flag/);
  });

  it("falla con --lossless y --lossy a la vez", () => {
    expect(() => parseArgs(["map.tmj", "--lossless", "--lossy"])).toThrow(/incompatible_flags/);
  });

  it("falla con quality fuera de rango", () => {
    expect(() => parseArgs(["map.tmj", "--lossy", "--quality", "200"])).toThrow(/invalid_quality/);
  });

  it("falla con padding negativo", () => {
    expect(() => parseArgs(["map.tmj", "--padding", "-1"])).toThrow(/invalid_padding/);
  });
});
