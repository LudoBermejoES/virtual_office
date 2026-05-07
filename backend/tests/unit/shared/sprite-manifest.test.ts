import { describe, it, expect } from "vitest";
import { SPRITE_MANIFEST } from "@virtual-office/shared";

describe("SPRITE_MANIFEST (shared, accesible desde backend)", () => {
  it("contiene la entrada 'cat' con paths y defaultTag", () => {
    expect(SPRITE_MANIFEST.cat).toBeDefined();
    expect(SPRITE_MANIFEST.cat?.png).toBe("/sprites/cat/animated_cat_48x48.png");
    expect(SPRITE_MANIFEST.cat?.json).toBe("/sprites/cat/animated_cat_48x48.json");
    expect(SPRITE_MANIFEST.cat?.defaultTag).toBe("walk");
  });

  it("todos los ids son strings no vacíos y todas las entradas tienen png+json", () => {
    for (const [id, entry] of Object.entries(SPRITE_MANIFEST)) {
      expect(id).toMatch(/^[a-z0-9_]+$/);
      expect(entry.png).toMatch(/^\/sprites\/[a-z0-9_]+\/.+\.png$/);
      expect(entry.json).toMatch(/^\/sprites\/[a-z0-9_]+\/.+\.json$/);
    }
  });
});
