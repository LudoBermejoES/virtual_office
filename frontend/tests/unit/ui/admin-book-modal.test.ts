import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mountAdminBookModal,
  unmountAdminBookModal,
} from "../../../src/ui/admin-book-modal.js";
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
const charlieUser: AdminBookModalUser = {
  id: 3,
  email: "charlie@teimas.com",
  name: "Charlie",
  avatar_url: null,
};

describe("admin-book-modal — modo book", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountAdminBookModal();
  });

  it("renderiza header con desk y fecha", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "viernes 8 de mayo",
      mode: { kind: "book", users: [meUser, bobUser], meId: 1 },
    });
    const header = doc.getElementById("admin-book-modal-header")!;
    expect(header.textContent).toContain("D5");
    const allText = walk(doc.body)
      .map((e) => e.textContent)
      .join("\n");
    expect(allText).toContain("viernes 8 de mayo");
  });

  it("lista usuarios con admin (yo) arriba; alfabético el resto", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [charlieUser, bobUser, meUser], meId: 1 },
    });
    // Filtramos solo las filas DIV (no checkboxes ni labels) por user.
    const rows = walk(doc.body).filter(
      (e) => e.tagName === "DIV" && e.dataset["userId"] !== undefined,
    );
    expect(rows.map((r) => r.dataset["userId"])).toEqual(["1", "2", "3"]);
    // El "(yo)" vive dentro del labelWrap del primer row.
    const firstRowText = walk(rows[0]!)
      .map((e) => e.textContent)
      .join(" ");
    expect(firstRowText).toContain("(yo)");
  });

  it("filtro reduce la lista en tiempo real", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [meUser, bobUser, charlieUser], meId: 1 },
    });
    const filter = doc.getElementById("admin-book-modal-filter")!;
    filter.value = "bob";
    filter.dispatch("input");
    const rows = walk(doc.body).filter(
      (e) => e.tagName === "DIV" && e.dataset["userId"] !== undefined,
    );
    expect(rows.map((r) => r.dataset["userId"])).toEqual(["2"]);
  });

  it("click en usuario lo selecciona; click en Guardar llama onConfirmBook con su id y deltas vacíos", () => {
    const onConfirm = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [meUser, bobUser], meId: 1 },
      onConfirmBook: onConfirm,
    });
    // El click selector vive en el labelWrap (primer hijo div del row).
    const bobRow = walk(doc.body).find(
      (e) => e.tagName === "DIV" && e.dataset["userId"] === "2",
    )!;
    const bobLabel = bobRow.children[0]!;
    bobLabel.click();

    const confirm = doc.getElementById("admin-book-modal-confirm")!;
    confirm.click();
    expect(onConfirm).toHaveBeenCalledWith(2, { create: [], deleteIds: [] });
  });

  it("ESC cierra el modal y llama onClose", () => {
    const onClose = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [meUser], meId: 1 },
      onClose,
    });
    expect(doc.byId.has("admin-book-modal-header")).toBe(true);
    doc.dispatch("keydown", { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(doc.byId.has("admin-book-modal-header")).toBe(false);
  });

  it("click fuera (en el overlay) cierra y llama onClose", () => {
    const onClose = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "book", users: [meUser], meId: 1 },
      onClose,
    });
    const overlay = walk(doc.body).find((e) => e.id === "admin-book-modal-overlay")!;
    overlay.dispatch("click", { stopPropagation: () => {} });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("admin-book-modal — modo book con weeklies (change 027)", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountAdminBookModal();
  });

  it("renderiza 7 checkboxes (L M X J V S D) por usuario", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "hoy",
      mode: { kind: "book", users: [meUser, bobUser], meId: 1 },
    });
    const grid = walk(doc.body).find((e) => e.dataset["dowGridFor"] === "2");
    expect(grid).toBeDefined();
    const cells = grid!.children;
    expect(cells).toHaveLength(7);
    const labels = cells.map((c) => c.dataset["dow"]);
    expect(labels).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });

  it("checkboxes precargados marcados según weeklyByUser", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "hoy",
      mode: {
        kind: "book",
        users: [meUser, bobUser],
        meId: 1,
        weeklyByUser: {
          "2": [
            { dow: 0, weeklyId: 100 },
            { dow: 2, weeklyId: 101 },
          ],
        },
      },
    });
    const grid = walk(doc.body).find((e) => e.dataset["dowGridFor"] === "2")!;
    const checkboxes = walk(grid).filter((e) => e.tagName === "INPUT");
    // Filtramos por dow del propio checkbox (no del label padre).
    const checkedDows = checkboxes.filter((cb) => cb.checked).map((cb) => cb.dataset["dow"]);
    expect(checkedDows.sort()).toEqual(["0", "2"]);
  });

  it("checkbox conflictivo (otro desk mismo dow) aparece deshabilitado", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "hoy",
      mode: {
        kind: "book",
        users: [meUser, bobUser],
        meId: 1,
        conflictingDowsByUser: { "2": [3] },
      },
    });
    const grid = walk(doc.body).find((e) => e.dataset["dowGridFor"] === "2")!;
    const cb3 = walk(grid).find(
      (e) => e.tagName === "INPUT" && e.dataset["dow"] === "3",
    )!;
    expect(cb3.disabled).toBe(true);
    // Otro dow sin conflicto sí está habilitado
    const cb0 = walk(grid).find(
      (e) => e.tagName === "INPUT" && e.dataset["dow"] === "0",
    )!;
    expect(cb0.disabled).toBe(false);
  });

  it("marcar checkbox y guardar produce delta create con (userId, dow)", () => {
    const onConfirm = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "hoy",
      mode: { kind: "book", users: [meUser, bobUser], meId: 1 },
      onConfirmBook: onConfirm,
    });
    const grid = walk(doc.body).find((e) => e.dataset["dowGridFor"] === "2")!;
    const cb1 = walk(grid).find(
      (e) => e.tagName === "INPUT" && e.dataset["dow"] === "1",
    )!;
    cb1.checked = true;
    cb1.dispatch("click", { stopPropagation: () => {} });

    const confirm = doc.getElementById("admin-book-modal-confirm")!;
    confirm.click();
    expect(onConfirm).toHaveBeenCalledWith(1, {
      create: [{ userId: 2, dow: 1 }],
      deleteIds: [],
    });
  });

  it("desmarcar checkbox precargado y guardar produce delta deleteIds", () => {
    const onConfirm = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "hoy",
      mode: {
        kind: "book",
        users: [meUser, bobUser],
        meId: 1,
        weeklyByUser: { "2": [{ dow: 0, weeklyId: 999 }] },
      },
      onConfirmBook: onConfirm,
    });
    const grid = walk(doc.body).find((e) => e.dataset["dowGridFor"] === "2")!;
    const cb0 = walk(grid).find(
      (e) => e.tagName === "INPUT" && e.dataset["dow"] === "0",
    )!;
    cb0.checked = false;
    cb0.dispatch("click", { stopPropagation: () => {} });

    const confirm = doc.getElementById("admin-book-modal-confirm")!;
    confirm.click();
    expect(onConfirm).toHaveBeenCalledWith(1, { create: [], deleteIds: [999] });
  });
});

describe("admin-book-modal — modo release", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountAdminBookModal();
  });

  it("muestra 'Reservado por <name>' y botón Liberar llama onConfirmRelease", () => {
    const onRelease = vi.fn();
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D1",
      dateLabel: "hoy",
      mode: { kind: "release", bookedBy: bobUser },
      onConfirmRelease: onRelease,
    });
    const allText = walk(doc.body)
      .map((e) => e.textContent)
      .join("\n");
    expect(allText).toContain("Reservado por Bob");
    expect(allText).toContain("bob@teimas.com");
    const releaseBtn = doc.getElementById("admin-book-modal-release")!;
    releaseBtn.click();
    expect(onRelease).toHaveBeenCalled();
  });
});

describe("admin-book-modal — modo fixed", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountAdminBookModal();
  });

  it("muestra aviso de fijo y referencia al admin panel", () => {
    mountAdminBookModal({
      doc: doc as unknown as Document,
      deskLabel: "D9",
      dateLabel: "hoy",
      mode: { kind: "fixed", assignedTo: bobUser },
    });
    const allText = walk(doc.body)
      .map((e) => e.textContent)
      .join("\n");
    expect(allText).toContain("Asignado fijo a Bob");
    expect(allText).toContain("admin panel");
    // No hay botón Reservar ni Liberar
    expect(doc.byId.has("admin-book-modal-confirm")).toBe(false);
    expect(doc.byId.has("admin-book-modal-release")).toBe(false);
  });
});
