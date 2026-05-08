import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mountWeeklyActionModal,
  unmountWeeklyActionModal,
} from "../../../src/ui/weekly-action-modal.js";

interface FakeEl {
  tagName: string;
  id: string;
  textContent: string;
  style: Record<string, string>;
  children: FakeEl[];
  parent: FakeEl | null;
  ownerDocument: FakeDoc;
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
  defaultView: { confirm: (msg: string) => boolean };
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
    style: {},
    children: [],
    parent: null,
    ownerDocument: doc,
    listeners: new Map(),
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

function makeDoc(confirmReturn = true): FakeDoc {
  const doc: FakeDoc = {
    body: undefined as unknown as FakeEl,
    byId: new Map(),
    defaultView: { confirm: vi.fn(() => confirmReturn) },
    listeners: new Map(),
    createElement: (tag) => makeEl(doc, tag),
    getElementById: (id) => doc.byId.get(id) ?? null,
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

describe("WeeklyActionModal", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountWeeklyActionModal();
  });

  it("modo user_self: muestra 'Saltarme hoy' + Cancelar", () => {
    const onSkip = vi.fn();
    mountWeeklyActionModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "lunes 4 de mayo",
      dowLabel: "lunes",
      mode: { kind: "user_self" },
      onSkipDay: onSkip,
    });
    const skip = doc.getElementById("weekly-action-modal-skip")!;
    expect(skip.textContent).toContain("Saltarme");
    expect(doc.byId.has("weekly-action-modal-cancel")).toBe(true);
    expect(doc.byId.has("weekly-action-modal-delete")).toBe(false);
    skip.click();
    expect(onSkip).toHaveBeenCalled();
  });

  it("modo user_self_with_exception: muestra 'Recuperar mi puesto'", () => {
    const onUnskip = vi.fn();
    mountWeeklyActionModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "lunes",
      dowLabel: "lunes",
      mode: { kind: "user_self_with_exception" },
      onUnskipDay: onUnskip,
    });
    const unskip = doc.getElementById("weekly-action-modal-unskip")!;
    expect(unskip.textContent).toContain("Recuperar");
    unskip.click();
    expect(onUnskip).toHaveBeenCalled();
  });

  it("modo admin: muestra Saltar + Quitar todos + Cancelar", () => {
    mountWeeklyActionModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "lunes",
      dowLabel: "lunes",
      mode: { kind: "admin", targetUserName: "Ana" },
    });
    expect(doc.byId.has("weekly-action-modal-skip")).toBe(true);
    expect(doc.byId.has("weekly-action-modal-delete")).toBe(true);
    expect(doc.byId.has("weekly-action-modal-cancel")).toBe(true);
    const header = doc.getElementById("weekly-action-modal-header")!;
    expect(header.textContent).toContain("Ana");
  });

  it("admin: 'Quitar todos' pide confirm; si confirma llama onDeleteWeekly", () => {
    const onDelete = vi.fn();
    mountWeeklyActionModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "lunes",
      dowLabel: "lunes",
      mode: { kind: "admin", targetUserName: "Ana" },
      onDeleteWeekly: onDelete,
    });
    const remove = doc.getElementById("weekly-action-modal-delete")!;
    remove.click();
    expect(doc.defaultView.confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it("admin: si confirm cancela, NO llama onDeleteWeekly", () => {
    doc = makeDoc(false); // confirm() devuelve false
    const onDelete = vi.fn();
    mountWeeklyActionModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "lunes",
      dowLabel: "lunes",
      mode: { kind: "admin", targetUserName: "Ana" },
      onDeleteWeekly: onDelete,
    });
    const remove = doc.getElementById("weekly-action-modal-delete")!;
    remove.click();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("ESC cierra el modal y llama onClose", () => {
    const onClose = vi.fn();
    mountWeeklyActionModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "lunes",
      dowLabel: "lunes",
      mode: { kind: "user_self" },
      onClose,
    });
    expect(doc.byId.has("weekly-action-modal-header")).toBe(true);
    doc.dispatch("keydown", { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(doc.byId.has("weekly-action-modal-header")).toBe(false);
  });

  it("click fuera (overlay) cierra y llama onClose", () => {
    const onClose = vi.fn();
    mountWeeklyActionModal({
      doc: doc as unknown as Document,
      deskLabel: "D5",
      dateLabel: "lunes",
      dowLabel: "lunes",
      mode: { kind: "user_self" },
      onClose,
    });
    const overlay = walk(doc.body).find((e) => e.id === "weekly-action-modal-overlay")!;
    overlay.click();
    expect(onClose).toHaveBeenCalled();
  });
});
