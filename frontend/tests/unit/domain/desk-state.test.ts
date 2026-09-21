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

  // Change 031: un puesto bloqueado por un placeholder "Bloqueado #N" se
  // renderiza como cualquier puesto ocupado por otra persona. No hay estado
  // visual nuevo: el cliente lo distingue por el nombre del ocupante.
  describe("puestos bloqueados con placeholder (change 031)", () => {
    const PLACEHOLDER_ID = 90;

    it("occupied cuando el bloqueo es una daily del placeholder", () => {
      expect(
        deskState({ id: 1 }, [{ deskId: 1, userId: PLACEHOLDER_ID, type: "daily" }], 7),
      ).toBe("occupied");
    });

    it("occupied cuando el bloqueo es weekly del placeholder", () => {
      expect(
        deskState({ id: 1 }, [{ deskId: 1, userId: PLACEHOLDER_ID, type: "weekly" }], 7),
      ).toBe("occupied");
    });

    it("fixed cuando el bloqueo es un fijo del placeholder", () => {
      expect(
        deskState({ id: 1 }, [{ deskId: 1, userId: PLACEHOLDER_ID, type: "fixed" }], 7),
      ).toBe("fixed");
    });
  });
});
