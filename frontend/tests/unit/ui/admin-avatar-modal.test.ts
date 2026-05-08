import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mountAdminAvatarModal,
  unmountAdminAvatarModal,
  type AvatarModalUser,
} from "../../../src/ui/admin-avatar-modal.js";

interface FakeEl {
  tagName: string;
  id: string;
  textContent: string;
  src: string;
  type: string;
  accept: string;
  files: { 0?: unknown; length: number } | null;
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
    src: "",
    type: "",
    accept: "",
    files: null,
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

const userGoogle: AvatarModalUser = {
  id: 42,
  name: "Bob",
  email: "bob@x",
  avatar_url: "https://lh3.googleusercontent.com/bob",
  avatar_locked: 0,
};

const userCustom: AvatarModalUser = {
  id: 42,
  name: "Bob",
  email: "bob@x",
  avatar_url: "/avatars/42_aabbccdd.png",
  avatar_locked: 1,
};

describe("AdminAvatarModal", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountAdminAvatarModal();
  });

  it("usuario sin override: muestra Subir + Cancelar (sin Resetear) y origen Google", () => {
    mountAdminAvatarModal({ doc: doc as unknown as Document, user: userGoogle });
    expect(doc.byId.has("admin-avatar-modal-upload")).toBe(true);
    expect(doc.byId.has("admin-avatar-modal-cancel")).toBe(true);
    expect(doc.byId.has("admin-avatar-modal-reset")).toBe(false);
    expect(doc.getElementById("admin-avatar-modal-origin")!.textContent).toContain("Google");
  });

  it("usuario con avatar_locked=1: muestra además botón Resetear y origen Custom", () => {
    mountAdminAvatarModal({ doc: doc as unknown as Document, user: userCustom });
    expect(doc.byId.has("admin-avatar-modal-reset")).toBe(true);
    expect(doc.getElementById("admin-avatar-modal-origin")!.textContent).toContain("Custom");
  });

  it("subir con fichero seleccionado llama POST /api/users/:id/avatar con FormData", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ user: userCustom }),
        }) as Response,
    );
    const onChanged = vi.fn();
    mountAdminAvatarModal({
      doc: doc as unknown as Document,
      user: userGoogle,
      fetchImpl: fetchMock as unknown as typeof fetch,
      onChanged,
    });
    const fileInput = doc.getElementById("admin-avatar-modal-file")!;
    fileInput.files = { 0: { name: "x.png" }, length: 1 };
    const upload = doc.getElementById("admin-avatar-modal-upload")!;
    upload.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/42/avatar",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onChanged).toHaveBeenCalled();
    // Modal cerrado.
    expect(doc.byId.has("admin-avatar-modal-header")).toBe(false);
  });

  it("subir sin fichero seleccionado no hace nada", async () => {
    const fetchMock = vi.fn();
    mountAdminAvatarModal({
      doc: doc as unknown as Document,
      user: userGoogle,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const upload = doc.getElementById("admin-avatar-modal-upload")!;
    upload.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resetear pide confirm y llama DELETE", async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response,
    );
    const onChanged = vi.fn();
    mountAdminAvatarModal({
      doc: doc as unknown as Document,
      user: userCustom,
      fetchImpl: fetchMock as unknown as typeof fetch,
      onChanged,
    });
    const reset = doc.getElementById("admin-avatar-modal-reset")!;
    reset.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(doc.defaultView.confirm).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/42/avatar",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("resetear con confirm cancelado no llama DELETE", async () => {
    doc = makeDoc(false);
    const fetchMock = vi.fn();
    mountAdminAvatarModal({
      doc: doc as unknown as Document,
      user: userCustom,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const reset = doc.getElementById("admin-avatar-modal-reset")!;
    reset.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ESC cierra el modal y llama onClose", () => {
    const onClose = vi.fn();
    mountAdminAvatarModal({ doc: doc as unknown as Document, user: userGoogle, onClose });
    expect(doc.byId.has("admin-avatar-modal-header")).toBe(true);
    doc.dispatch("keydown", { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(doc.byId.has("admin-avatar-modal-header")).toBe(false);
  });

  it("click fuera (overlay) cierra y llama onClose", () => {
    const onClose = vi.fn();
    mountAdminAvatarModal({ doc: doc as unknown as Document, user: userGoogle, onClose });
    const overlay = doc.getElementById("admin-avatar-modal-overlay")!;
    overlay.click();
    expect(onClose).toHaveBeenCalled();
  });
});
