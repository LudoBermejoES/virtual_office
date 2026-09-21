/**
 * Change 031: la pestaña USUARIOS separa personas de placeholders
 * "Bloqueado #N". La lógica de partición se extrae a una función pura
 * (`partitionUsers`) porque `renderUsuarios` usa `document` y `fetch`
 * globales y no admite inyección de doc.
 */
import { describe, it, expect } from "vitest";
import { partitionUsers } from "../../../src/ui/admin-panel.js";

const alice = {
  id: 1,
  name: "Alice",
  email: "alice@teimas.com",
  role: "admin",
  avatar_url: null,
  avatar_locked: 0,
  is_placeholder: 0,
};
const bob = {
  id: 2,
  name: "Bob",
  email: "bob@teimas.com",
  role: "member",
  avatar_url: null,
  avatar_locked: 0,
  is_placeholder: 0,
};
const ph1 = {
  id: 90,
  name: "Bloqueado #1",
  email: "bloqueado1@teimas.space",
  role: "member",
  avatar_url: null,
  avatar_locked: 0,
  is_placeholder: 1,
};
const ph2 = {
  id: 91,
  name: "Bloqueado #2",
  email: "bloqueado2@teimas.space",
  role: "member",
  avatar_url: null,
  avatar_locked: 0,
  is_placeholder: 1,
};

describe("partitionUsers (change 031)", () => {
  it("separa personas de placeholders preservando el orden de cada grupo", () => {
    const { people, placeholders } = partitionUsers([alice, ph1, bob, ph2]);
    expect(people.map((u) => u.name)).toEqual(["Alice", "Bob"]);
    expect(placeholders.map((u) => u.name)).toEqual(["Bloqueado #1", "Bloqueado #2"]);
  });

  it("sin placeholders devuelve la lista completa como personas", () => {
    const { people, placeholders } = partitionUsers([alice, bob]);
    expect(people).toHaveLength(2);
    expect(placeholders).toHaveLength(0);
  });

  it("solo placeholders deja people vacío", () => {
    const { people, placeholders } = partitionUsers([ph1, ph2]);
    expect(people).toHaveLength(0);
    expect(placeholders).toHaveLength(2);
  });

  it("trata is_placeholder ausente como persona (payload antiguo)", () => {
    const legacy = { ...alice } as Partial<typeof alice> & { id: number; name: string };
    delete legacy.is_placeholder;
    const { people, placeholders } = partitionUsers([legacy as typeof alice]);
    expect(people).toHaveLength(1);
    expect(placeholders).toHaveLength(0);
  });

  it("lista vacía no rompe", () => {
    const { people, placeholders } = partitionUsers([]);
    expect(people).toEqual([]);
    expect(placeholders).toEqual([]);
  });
});
