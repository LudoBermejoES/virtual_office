import { describe, it, expect } from "vitest";
import { deskState } from "../../../src/domain/desk-state.js";

describe("deskState (frontend)", () => {
  it("free si no hay booking", () => {
    expect(deskState({ id: 1 }, [], 7)).toBe("free");
  });

  it("mine si la booking es del usuario actual", () => {
    expect(deskState({ id: 1 }, [{ deskId: 1, userId: 7, type: "daily" }], 7)).toBe("mine");
  });

  it("occupied si la booking es de otro user", () => {
    expect(deskState({ id: 1 }, [{ deskId: 1, userId: 99, type: "daily" }], 7)).toBe(
      "occupied",
    );
  });

  it("fixed si la booking es type=fixed independiente del user", () => {
    expect(deskState({ id: 1 }, [{ deskId: 1, userId: 99, type: "fixed" }], 7)).toBe("fixed");
    expect(deskState({ id: 1 }, [{ deskId: 1, userId: 7, type: "fixed" }], 7)).toBe("fixed");
  });
});
