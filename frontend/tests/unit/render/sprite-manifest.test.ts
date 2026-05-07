import { describe, it, expect } from "vitest";
import { SPRITE_MANIFEST as FRONT } from "../../../src/render/sprite-manifest.js";
import { SPRITE_MANIFEST as SHARED } from "@virtual-office/shared";

describe("sprite-manifest (frontend re-export)", () => {
  it("re-exporta exactamente el mismo objeto que @virtual-office/shared", () => {
    expect(FRONT).toBe(SHARED);
  });

  it("contiene la entrada 'cat'", () => {
    expect(FRONT.cat).toBeDefined();
    expect(FRONT.cat?.defaultTag).toBe("walk");
  });
});
