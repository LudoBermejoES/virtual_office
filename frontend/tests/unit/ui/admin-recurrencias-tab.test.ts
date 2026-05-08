import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  renderRecurrenciasTab,
  type WeeklyRow,
} from "../../../src/ui/admin-recurrencias-tab.js";

interface FakeEl {
  tagName: string;
  id: string;
  textContent: string;
  value: string;
  type: string;
  placeholder: string;
  style: Record<string, string>;
  dataset: Record<string, string>;
  children: FakeEl[];
  parent: FakeEl | null;
  listeners: Map<string, Array<(ev: unknown) => void>>;
  ownerDocument: FakeDoc;
  appendChild(c: FakeEl): FakeEl;
  remove(): void;
  addEventListener(t: string, cb: (ev: unknown) => void): void;
  dispatch(t: string, ev?: unknown): void;
  click(): void;
  parentElement: FakeEl | null;
  innerHTML: string;
}

interface FakeDoc {
  body: FakeEl;
  byId: Map<string, FakeEl>;
  defaultView: { confirm: (msg: string) => boolean };
  createElement(tag: string): FakeEl;
  getElementById(id: string): FakeEl | null;
}

function makeEl(doc: FakeDoc, tag: string): FakeEl {
  const el: FakeEl = {
    tagName: tag.toUpperCase(),
    id: "",
    textContent: "",
    value: "",
    type: "",
    placeholder: "",
    style: {},
    dataset: {},
    children: [],
    parent: null,
    listeners: new Map(),
    ownerDocument: doc,
    parentElement: null,
    innerHTML: "",
    appendChild(c) {
      c.parent = el;
      c.parentElement = el;
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
    dispatch(t, ev) {
      const arr = el.listeners.get(t) ?? [];
      for (const cb of arr) cb(ev ?? {});
    },
    click() {
      el.dispatch("click", {});
    },
  };
  // innerHTML setter clears children when set to "".
  Object.defineProperty(el, "innerHTML", {
    get() {
      return "";
    },
    set(v: string) {
      if (v === "") {
        for (const c of [...el.children]) {
          if (c.id) doc.byId.delete(c.id);
        }
        el.children.length = 0;
      }
    },
  });
  return el;
}

function makeDoc(confirmReturn = true): FakeDoc {
  const doc: FakeDoc = {
    body: undefined as unknown as FakeEl,
    byId: new Map(),
    defaultView: { confirm: vi.fn(() => confirmReturn) },
    createElement: (tag) => makeEl(doc, tag),
    getElementById: (id) => doc.byId.get(id) ?? null,
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

function findRows(container: FakeEl): FakeEl[] {
  return walk(container).filter((e) => e.dataset["weeklyId"]);
}

const baseRow = (over: Partial<WeeklyRow> & { id: number; dow: number }): WeeklyRow => ({
  desk: { id: over.id, label: `D${String(over.id)}` },
  user: { id: 100 + over.id, name: "Ana", email: "ana@x", avatar_url: null },
  created_at: "2026-01-01",
  exceptions: [],
  ...over,
});

describe("RecurrenciasTab", () => {
  let doc: FakeDoc;
  let container: FakeEl;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    doc = makeDoc();
    container = doc.createElement("div");
  });

  function fetchReturning(rows: WeeklyRow[]): ReturnType<typeof vi.fn> {
    return vi.fn(async () => ({ ok: true, json: async () => rows }) as Response);
  }

  it("carga y renderiza tabla con weeklies", async () => {
    fetchMock = fetchReturning([
      baseRow({ id: 1, dow: 0, exceptions: [] }),
      baseRow({ id: 2, dow: 2, exceptions: [] }),
    ]);
    renderRecurrenciasTab({
      doc: doc as unknown as Document,
      container: container as unknown as HTMLElement,
      baseUrl: "",
      offices: [{ id: 9, name: "HQ" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((r) => setTimeout(r, 0));
    const rows = findRows(container);
    expect(rows).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/offices/9/weekly", expect.objectContaining({}));
  });

  it("filtro por usuario reduce filas (case-insensitive contains)", async () => {
    fetchMock = fetchReturning([
      baseRow({
        id: 1,
        dow: 0,
        user: { id: 1, name: "Ana López", email: "a@x", avatar_url: null },
      }),
      baseRow({
        id: 2,
        dow: 1,
        user: { id: 2, name: "Bob", email: "b@x", avatar_url: null },
      }),
    ]);
    renderRecurrenciasTab({
      doc: doc as unknown as Document,
      container: container as unknown as HTMLElement,
      baseUrl: "",
      offices: [{ id: 9, name: "HQ" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((r) => setTimeout(r, 0));
    const userFilter = doc.getElementById("admin-rec-filter-user")!;
    userFilter.value = "ana";
    userFilter.dispatch("input");
    expect(findRows(container)).toHaveLength(1);
  });

  it("filtro por dow reduce filas", async () => {
    fetchMock = fetchReturning([
      baseRow({ id: 1, dow: 0 }),
      baseRow({ id: 2, dow: 1 }),
      baseRow({ id: 3, dow: 0 }),
    ]);
    renderRecurrenciasTab({
      doc: doc as unknown as Document,
      container: container as unknown as HTMLElement,
      baseUrl: "",
      offices: [{ id: 9, name: "HQ" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((r) => setTimeout(r, 0));
    const dowFilter = doc.getElementById("admin-rec-filter-dow")!;
    dowFilter.value = "0";
    dowFilter.dispatch("change");
    expect(findRows(container)).toHaveLength(2);
  });

  it("borrar weekly: confirm + DELETE + fila desaparece", async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        json: async () => [baseRow({ id: 1, dow: 0 }), baseRow({ id: 2, dow: 1 })],
      } as Response;
    });
    renderRecurrenciasTab({
      doc: doc as unknown as Document,
      container: container as unknown as HTMLElement,
      baseUrl: "",
      offices: [{ id: 9, name: "HQ" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((r) => setTimeout(r, 0));
    const rows = findRows(container);
    const delBtn = walk(rows[0]!).find((e) => e.dataset["role"] === "delete-weekly")!;
    delBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(doc.defaultView.confirm).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/desks/1/weekly/1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(findRows(container)).toHaveLength(1);
  });

  it("badge de excepciones aparece cuando exceptions.length > 0", async () => {
    fetchMock = fetchReturning([
      baseRow({ id: 1, dow: 0, exceptions: ["2026-05-04", "2026-05-11"] }),
      baseRow({ id: 2, dow: 1, exceptions: [] }),
    ]);
    renderRecurrenciasTab({
      doc: doc as unknown as Document,
      container: container as unknown as HTMLElement,
      baseUrl: "",
      offices: [{ id: 9, name: "HQ" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((r) => setTimeout(r, 0));
    const badges = walk(container).filter((e) => e.dataset["role"] === "exceptions-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]!.textContent).toContain("2 excepciones");
  });

  it("badge click abre popover; 'Limpiar todas' borra cada exception", async () => {
    const deletedDates: string[] = [];
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        const body = JSON.parse(String(init.body ?? "{}")) as { date: string };
        deletedDates.push(body.date);
        return { ok: true, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        json: async () => [
          baseRow({ id: 1, dow: 0, exceptions: ["2026-05-04", "2026-05-11"] }),
        ],
      } as Response;
    });
    renderRecurrenciasTab({
      doc: doc as unknown as Document,
      container: container as unknown as HTMLElement,
      baseUrl: "",
      offices: [{ id: 9, name: "HQ" }],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((r) => setTimeout(r, 0));
    const badge = walk(container).find((e) => e.dataset["role"] === "exceptions-badge")!;
    badge.click();
    const popover = doc.getElementById("admin-rec-exceptions-popover")!;
    expect(popover).toBeTruthy();
    const clear = walk(popover).find((e) => e.dataset["role"] === "clear-exceptions")!;
    clear.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(deletedDates).toEqual(["2026-05-04", "2026-05-11"]);
    // Tras limpiar, badge desaparece
    expect(
      walk(container).find((e) => e.dataset["role"] === "exceptions-badge"),
    ).toBeUndefined();
  });
});
