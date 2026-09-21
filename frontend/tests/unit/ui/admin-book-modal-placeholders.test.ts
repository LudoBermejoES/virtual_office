/**
 * Change 031: los placeholders "Bloqueado #N" en el modal de reserva del
 * admin. Van al final de la lista bajo un separador, y se deshabilitan
 * cuando ya están bloqueando otro puesto ese mismo día.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountAdminBookModal, unmountAdminBookModal } from "../../../src/ui/admin-book-modal.js";
import type { AdminBookModalUser } from "../../../src/ui/admin-book-modal.js";

interface FakeEl {
  tagName: string;
  id: string;
  textContent: string;
  title: string;
  type: string;
  value: string;
  placeholder: string;
  checked: boolean;
  disabled: boolean;
  style: Record<string, string>;
  dataset: Record<string, string>;
  children: FakeEl[];
  parent: FakeEl | null;
  ownerDocument: FakeDoc;
  innerHTML: string;
  listeners: Map<string, Array<(ev: unknown) => void>>;
  appendChild(c: FakeEl): FakeEl;
  remove(): void;
  addEventListener(t: string, cb: (ev: unknown) => void): void;
  removeEventListener(t: string, cb: (ev: unknown) => void): void;
  dispatch(t: string, ev?: unknown): void;
  click(): void;
}

interface FakeDoc {
  body: FakeEl;
  byId: Map<string, FakeEl>;
  listeners: Map<string, Array<(ev: unknown) => void>>;
  createElement(tag: string): FakeEl;
  getElementById(id: string): FakeEl | null;
  addEventListener(t: string, cb: (ev: unknown) => void): void;
  removeEventListener(t: string, cb: (ev: unknown) => void): void;
  dispatch(t: string, ev: unknown): void;
}

function makeEl(doc: FakeDoc, tag: string): FakeEl {
  const el: FakeEl = {
    tagName: tag.toUpperCase(),
    id: "",
    textContent: "",
    title: "",
    type: "",
    value: "",
    placeholder: "",
    checked: false,
    disabled: false,
    style: {},
    dataset: {},
    children: [],
    parent: null,
    ownerDocument: doc,
    listeners: new Map(),
    get innerHTML() {
      return "";
    },
    set innerHTML(_v: string) {
      el.children = [];
    },
    appendChild(c) {
      c.parent = el;
      el.children.push(c);
      if (c.id) doc.byId.set(c.id, c);
      return c;
    },
    remove() {
      if (el.parent) {
        const i = el.parent.children.indexOf(el);
        if (i >= 0) el.parent.children.splice(i, 1);
      }
      // Limpia ids de este nodo y todos sus descendientes (jsdom hace esto
      // automáticamente; nuestro mock lo simula recorriendo el subtree).
      const stack: FakeEl[] = [el];
      while (stack.length) {
        const cur = stack.pop()!;
        if (cur.id) doc.byId.delete(cur.id);
        for (const c of cur.children) stack.push(c);
      }
    },
    addEventListener(t, cb) {
      const arr = el.listeners.get(t) ?? [];
      arr.push(cb);
      el.listeners.set(t, arr);
    },
    removeEventListener(t, cb) {
      const arr = el.listeners.get(t) ?? [];
      const i = arr.indexOf(cb);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatch(t, ev) {
      const arr = el.listeners.get(t) ?? [];
      for (const cb of arr) cb(ev ?? { stopPropagation: () => {} });
    },
    click() {
      el.dispatch("click", { stopPropagation: () => {} });
    },
  };
  return el;
}

function makeDoc(): FakeDoc {
  const doc: FakeDoc = {
    body: undefined as unknown as FakeEl,
    byId: new Map(),
    listeners: new Map(),
    createElement: (tag) => makeEl(doc, tag),
    getElementById(id) {
      return doc.byId.get(id) ?? null;
    },
    addEventListener(t, cb) {
      const arr = doc.listeners.get(t) ?? [];
      arr.push(cb);
      doc.listeners.set(t, arr);
    },
    removeEventListener(t, cb) {
      const arr = doc.listeners.get(t) ?? [];
      const i = arr.indexOf(cb);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatch(t, ev) {
      const arr = doc.listeners.get(t) ?? [];
      for (const cb of arr) cb(ev);
    },
  };
  doc.body = makeEl(doc, "body");
  return doc;
}

function walk(root: FakeEl): FakeEl[] {
  const out: FakeEl[] = [];
  const queue: FakeEl[] = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur);
    for (const c of cur.children) queue.push(c);
  }
  return out;
}

const meUser: AdminBookModalUser = {
  id: 1,
  email: "alice@teimas.com",
  name: "Alice Admin",
  avatar_url: null,
};
const bobUser: AdminBookModalUser = {
  id: 2,
  email: "bob@teimas.com",
  name: "Bob",
  avatar_url: null,
};
const ph1: AdminBookModalUser = {
  id: 90,
  email: "bloqueado1@teimas.space",
  name: "Bloqueado #1",
  avatar_url: null,
  isPlaceholder: true,
};
const ph2: AdminBookModalUser = {
  id: 91,
  email: "bloqueado2@teimas.space",
  name: "Bloqueado #2",
  avatar_url: null,
  isPlaceholder: true,
};
const ph3: AdminBookModalUser = {
  id: 92,
  email: "bloqueado3@teimas.space",
  name: "Bloqueado #3",
  avatar_url: null,
  isPlaceholder: true,
};

const ALL = [bobUser, meUser, ph1, ph2, ph3];

function rowsOf(doc: FakeDoc) {
  return walk(doc.body).filter((e) => e.tagName === "DIV" && e.dataset["userId"] !== undefined);
}

function allText(doc: FakeDoc): string {
  return walk(doc.body)
    .map((e) => e.textContent)
    .join("\n");
}

describe("admin-book-modal — placeholders (change 031)", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountAdminBookModal();
  });

  it("renderiza los placeholders al final, bajo un separador BLOQUEAR PUESTO", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: ALL, meId: 1 },
    });

    // Orden: yo (1), resto alfabético (2), luego los tres placeholders.
    expect(rowsOf(doc).map((r) => r.dataset["userId"])).toEqual(["1", "2", "90", "91", "92"]);
    expect(allText(doc)).toContain("BLOQUEAR PUESTO");
  });

  it("seleccionar un placeholder y guardar invoca onConfirmBook con su userId", () => {
    const onConfirm = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: ALL, meId: 1 },
      onConfirmBook: onConfirm,
    });

    const phRow = rowsOf(doc).find((r) => r.dataset["userId"] === "90")!;
    phRow.children[0]!.click();
    doc.getElementById("admin-book-modal-confirm")!.click();

    expect(onConfirm).toHaveBeenCalledWith(90, { create: [], deleteIds: [] });
  });

  it("el filtro encuentra los placeholders y oculta los usuarios reales", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: ALL, meId: 1 },
    });

    const filter = doc.getElementById("admin-book-modal-filter")!;
    filter.value = "bloq";
    filter.dispatch("input");

    expect(rowsOf(doc).map((r) => r.dataset["userId"])).toEqual(["90", "91", "92"]);
  });

  it("un placeholder ya usado ese día se renderiza deshabilitado y no seleccionable", () => {
    const onConfirm = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [bobUser, meUser, { ...ph1, usedToday: true }, ph2, ph3], meId: 1 },
      onConfirmBook: onConfirm,
    });

    const phRow = rowsOf(doc).find((r) => r.dataset["userId"] === "90")!;
    expect(phRow.dataset["disabled"]).toBe("true");
    const rowText = walk(phRow)
      .map((e) => e.title)
      .join(" ");
    expect(rowText).toContain("ya está bloqueando otro puesto");

    // Click no lo selecciona: al guardar sigue el admin (yo) seleccionado.
    phRow.children[0]!.click();
    doc.getElementById("admin-book-modal-confirm")!.click();
    expect(onConfirm).toHaveBeenCalledWith(1, { create: [], deleteIds: [] });
  });

  it("los otros dos placeholders siguen seleccionables cuando uno está agotado", () => {
    const onConfirm = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [bobUser, meUser, { ...ph1, usedToday: true }, ph2, ph3], meId: 1 },
      onConfirmBook: onConfirm,
    });

    const free = rowsOf(doc).find((r) => r.dataset["userId"] === "91")!;
    expect(free.dataset["disabled"]).toBeUndefined();
    free.children[0]!.click();
    doc.getElementById("admin-book-modal-confirm")!.click();
    expect(onConfirm).toHaveBeenCalledWith(91, { create: [], deleteIds: [] });
  });

  it("con los tres agotados el separador avisa 'sin bloqueos libres este día'", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: {
        kind: "book",
        users: [
          bobUser,
          meUser,
          { ...ph1, usedToday: true },
          { ...ph2, usedToday: true },
          { ...ph3, usedToday: true },
        ],
        meId: 1,
      },
    });

    expect(allText(doc)).toContain("sin bloqueos libres este día");
  });

  it("marcar un checkbox de recurrencia de un placeholder produce delta create", () => {
    const onConfirm = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: ALL, meId: 1 },
      onConfirmBook: onConfirm,
    });

    const cb = walk(doc.body).find(
      (e) => e.type === "checkbox" && e.dataset["userId"] === "90" && e.dataset["dow"] === "0",
    )!;
    cb.checked = true;
    cb.dispatch("click");
    doc.getElementById("admin-book-modal-confirm")!.click();

    expect(onConfirm).toHaveBeenCalledWith(1, {
      create: [{ userId: 90, dow: 0 }],
      deleteIds: [],
    });
  });

  it("sin placeholders en la lista no se renderiza el separador (regresión)", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [meUser, bobUser], meId: 1 },
    });

    expect(allText(doc)).not.toContain("BLOQUEAR PUESTO");
    expect(rowsOf(doc).map((r) => r.dataset["userId"])).toEqual(["1", "2"]);
  });
});
