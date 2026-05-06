import { describe, it, expect, beforeEach } from "vitest";

// Fake DOM minimal antes de importar el módulo
type Listener = (e: unknown) => void;

interface FakeNode {
  parentNode: FakeNode | null;
  children: FakeEl[];
  contains(target: FakeNode | null): boolean;
}

interface FakeEl extends FakeNode {
  tagName: string;
  id: string;
  className: string;
  classList: {
    add(cls: string): void;
    contains(cls: string): boolean;
  };
  textContent: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  disabled: boolean;
  innerHTML: string;
  _listeners: Record<string, Listener[]>;
  appendChild(child: FakeEl): FakeEl;
  remove(): void;
  addEventListener(event: string, fn: Listener): void;
  click(): void;
  querySelector(sel: string): FakeEl | null;
  querySelectorAll(sel: string): FakeEl[];
}

const documentListeners: Record<string, Listener[]> = {};
let body: FakeEl;

function makeEl(tagName = "div"): FakeEl {
  const el: FakeEl = {
    tagName,
    id: "",
    className: "",
    classList: {
      add(cls: string) {
        if (!el.className.split(" ").includes(cls)) {
          el.className = (el.className + " " + cls).trim();
        }
      },
      contains(cls: string) {
        return el.className.split(" ").includes(cls);
      },
    },
    textContent: "",
    dataset: {},
    style: {},
    disabled: false,
    parentNode: null,
    children: [],
    _listeners: {},
    get innerHTML() {
      return "";
    },
    set innerHTML(v: string) {
      if (v === "") el.children.length = 0;
    },
    contains(target: FakeNode | null): boolean {
      if (!target) return false;
      if (target === el) return true;
      return el.children.some((c) => c.contains(target));
    },
    appendChild(child: FakeEl) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    remove() {
      if (el.parentNode) {
        el.parentNode.children = el.parentNode.children.filter((c) => c !== el);
        el.parentNode = null;
      }
    },
    addEventListener(event: string, fn: Listener) {
      el._listeners[event] = el._listeners[event] ?? [];
      el._listeners[event].push(fn);
    },
    click() {
      const fns = el._listeners["click"] ?? [];
      const fakeEvent = { stopPropagation: () => {}, preventDefault: () => {} };
      for (const fn of fns) fn(fakeEvent);
    },
    querySelector(sel: string) {
      return el.querySelectorAll(sel)[0] ?? null;
    },
    querySelectorAll(sel: string) {
      const results: FakeEl[] = [];
      const walk = (n: FakeEl) => {
        if (matches(n, sel)) results.push(n);
        for (const c of n.children) walk(c);
      };
      walk(el);
      return results;
    },
  };
  return el;
}

function matches(el: FakeEl, sel: string): boolean {
  // Soporta:  ".class"  "[data-foo]"  "[data-foo='bar']"  "tag"  "#id"
  if (sel.startsWith(".")) return el.className.split(" ").includes(sel.slice(1));
  if (sel.startsWith("#")) return el.id === sel.slice(1);
  const attrEq = sel.match(/^\[([^=\]]+)='([^']+)'\]$/);
  if (attrEq) {
    const [, attr, value] = attrEq;
    const camel = attr!.replace(/^data-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return el.dataset[camel] === value;
  }
  const attr = sel.match(/^\[([^\]]+)\]$/);
  if (attr) {
    const camel = attr[1]!.replace(/^data-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return camel in el.dataset;
  }
  return el.tagName === sel;
}

beforeEach(async () => {
  body = makeEl("body");
  for (const k of Object.keys(documentListeners)) delete documentListeners[k];

  (globalThis as unknown as { document: unknown }).document = {
    createElement(tag: string) {
      return makeEl(tag);
    },
    body,
    addEventListener(event: string, fn: Listener, _capture?: boolean) {
      documentListeners[event] = documentListeners[event] ?? [];
      documentListeners[event].push(fn);
    },
    removeEventListener(event: string, fn: Listener) {
      const list = documentListeners[event];
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
  };

  // Asegurar estado limpio del módulo entre tests
  const mod = await import("../../../src/ui/day-picker.js");
  mod.unmountDayPicker();
});

function dispatch(event: string, payload: unknown): void {
  const list = documentListeners[event] ?? [];
  for (const fn of [...list]) fn(payload);
}

describe("day-picker", () => {
  it("mountDayPicker añade overlay #day-picker al body", async () => {
    const { mountDayPicker, isDayPickerOpen, unmountDayPicker } = await import(
      "../../../src/ui/day-picker.js"
    );
    expect(isDayPickerOpen()).toBe(false);
    mountDayPicker();
    expect(isDayPickerOpen()).toBe(true);
    expect(body.children.find((c) => c.id === "day-picker")).toBeTruthy();
    unmountDayPicker();
  });

  it("mountDayPicker es idempotente sin unmount previo", async () => {
    const { mountDayPicker, unmountDayPicker } = await import("../../../src/ui/day-picker.js");
    mountDayPicker();
    mountDayPicker();
    expect(body.children.filter((c) => c.id === "day-picker")).toHaveLength(1);
    unmountDayPicker();
  });

  it("unmountDayPicker quita el overlay", async () => {
    const { mountDayPicker, unmountDayPicker, isDayPickerOpen } = await import(
      "../../../src/ui/day-picker.js"
    );
    mountDayPicker();
    unmountDayPicker();
    expect(isDayPickerOpen()).toBe(false);
    expect(body.children.find((c) => c.id === "day-picker")).toBeUndefined();
  });

  it("click en celda válida llama a uiStore.setDate y desmonta", async () => {
    const { mountDayPicker, isDayPickerOpen } = await import("../../../src/ui/day-picker.js");
    const { uiStore } = await import("../../../src/state/ui.js");
    const today = uiStore.getState().today;
    mountDayPicker();
    const overlay = body.children.find((c) => c.id === "day-picker")!;
    const cell = overlay.querySelectorAll(`[data-iso='${today}']`)[0];
    expect(cell).toBeTruthy();
    cell!.click();
    expect(isDayPickerOpen()).toBe(false);
    expect(uiStore.getState().selectedDate).toBe(today);
  });

  it("click en celda fuera de horizonte no cambia fecha ni desmonta", async () => {
    const { mountDayPicker, isDayPickerOpen, unmountDayPicker } = await import(
      "../../../src/ui/day-picker.js"
    );
    mountDayPicker();
    const overlay = body.children.find((c) => c.id === "day-picker")!;
    const outCells = overlay.querySelectorAll(".day-picker__cell--out");
    if (outCells.length > 0) {
      const before = isDayPickerOpen();
      outCells[0]!.click();
      expect(isDayPickerOpen()).toBe(before);
    }
    unmountDayPicker();
  });

  it("Esc cierra el overlay", async () => {
    const { mountDayPicker, isDayPickerOpen } = await import("../../../src/ui/day-picker.js");
    mountDayPicker();
    expect(isDayPickerOpen()).toBe(true);
    dispatch("keydown", { key: "Escape", stopPropagation: () => {} });
    expect(isDayPickerOpen()).toBe(false);
  });

  it("click fuera del overlay cierra", async () => {
    const { mountDayPicker, isDayPickerOpen } = await import("../../../src/ui/day-picker.js");
    mountDayPicker();
    expect(isDayPickerOpen()).toBe(true);
    const outsideEl = makeEl("div");
    body.appendChild(outsideEl);
    dispatch("mousedown", { target: outsideEl });
    expect(isDayPickerOpen()).toBe(false);
  });

  it("click dentro del overlay no cierra", async () => {
    const { mountDayPicker, isDayPickerOpen, unmountDayPicker } = await import(
      "../../../src/ui/day-picker.js"
    );
    mountDayPicker();
    const overlay = body.children.find((c) => c.id === "day-picker")!;
    dispatch("mousedown", { target: overlay });
    expect(isDayPickerOpen()).toBe(true);
    unmountDayPicker();
  });

  it("botón > avanza mes (cambia el header)", async () => {
    const { mountDayPicker, unmountDayPicker } = await import("../../../src/ui/day-picker.js");
    mountDayPicker();
    const overlay = body.children.find((c) => c.id === "day-picker")!;
    const titleBefore = overlay.querySelector(".day-picker__title")!.textContent;
    const next = overlay.querySelectorAll("[data-nav='next']")[0]!;
    next.click();
    const titleAfter = body
      .children.find((c) => c.id === "day-picker")!
      .querySelector(".day-picker__title")!.textContent;
    expect(titleAfter).not.toBe(titleBefore);
    unmountDayPicker();
  });
});
