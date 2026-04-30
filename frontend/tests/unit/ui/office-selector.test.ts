import { describe, it, expect } from "vitest";
import { mountOfficeSelector } from "../../../src/ui/office-selector.js";
import type { OfficeSummary } from "@virtual-office/shared";

function makeOffice(id: number, name: string): OfficeSummary {
  return { id, name, is_admin: false, is_default: false };
}

type ClickHandler = () => void;

interface FakeEl {
  tagName: string;
  className: string;
  textContent: string;
  dataset: Record<string, string>;
  children: FakeEl[];
  _clickHandlers: ClickHandler[];
  innerHTML: string;
  addEventListener(event: string, fn: ClickHandler): void;
  appendChild(child: FakeEl): void;
  click(): void;
  querySelectorAll(sel: string): FakeEl[];
}

function makeEl(tagName = "div"): FakeEl {
  const el: FakeEl = {
    tagName,
    className: "",
    textContent: "",
    dataset: {},
    children: [],
    _clickHandlers: [],
    get innerHTML() {
      return "";
    },
    set innerHTML(v: string) {
      if (v === "") el.children.length = 0;
    },
    addEventListener(event: string, fn: ClickHandler) {
      if (event === "click") el._clickHandlers.push(fn);
    },
    appendChild(child: FakeEl) {
      el.children.push(child);
      return child;
    },
    click() {
      for (const fn of el._clickHandlers) fn();
    },
    querySelectorAll(selector: string) {
      // Convert data-foo-bar → fooBar for dataset lookup
      const rawAttr = selector.match(/\[([^\]]+)\]/)?.[1] ?? "";
      const camel = rawAttr.replace(/^data-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const results: FakeEl[] = [];
      function walk(node: FakeEl) {
        if (camel && camel in node.dataset) results.push(node);
        for (const c of node.children) walk(c);
      }
      walk(el);
      return results;
    },
  };
  return el;
}

// Parcha createElement globalmente para este módulo
const createdElements: FakeEl[] = [];
(globalThis as unknown as { document: unknown }).document = {
  createElement(tag: string) {
    const el = makeEl(tag);
    createdElements.push(el);
    return el;
  },
};

function allText(el: FakeEl): string {
  return el.textContent + el.children.map(allText).join("");
}

describe("mountOfficeSelector", () => {
  it("muestra el nombre de la oficina actual", () => {
    const container = makeEl();
    const offices = [makeOffice(1, "Compostela"), makeOffice(2, "Madrid")];
    mountOfficeSelector(container as never, 1, offices, () => {});
    expect(allText(container)).toContain("Compostela");
  });

  it("dispara onChange con el id correcto al hacer click en otra oficina", () => {
    const container = makeEl();
    const offices = [makeOffice(1, "Compostela"), makeOffice(2, "Madrid")];
    const changes: number[] = [];
    mountOfficeSelector(container as never, 1, offices, (id) => changes.push(id));

    const items = container.querySelectorAll("[data-office-id]");
    const madridItem = items.find((el) => el.dataset["officeId"] === "2");
    madridItem?.click();

    expect(changes).toEqual([2]);
  });

  it("con una sola oficina no renderiza opciones clicables", () => {
    const container = makeEl();
    const offices = [makeOffice(3, "Única")];
    mountOfficeSelector(container as never, 3, offices, () => {});

    const items = container.querySelectorAll("[data-office-id]");
    expect(items.length).toBe(0);
  });
});
