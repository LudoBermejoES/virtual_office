import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mountMapEditorSpritePopover,
  unmountMapEditorSpritePopover,
} from "../../../src/ui/map-editor-sprite-popover.js";
import { mapEditorStore } from "../../../src/state/map-editor.js";

interface FakeWindow {
  confirm: (message: string) => boolean;
}

interface FakeEl {
  tagName: string;
  id: string;
  textContent: string;
  value: string;
  style: Record<string, string>;
  children: FakeEl[];
  parent: FakeEl | null;
  ownerDocument: FakeDoc;
  innerHTML: string;
  listeners: Map<string, Array<(ev?: unknown) => void>>;
  appendChild(c: FakeEl): FakeEl;
  remove(): void;
  addEventListener(t: string, cb: (ev?: unknown) => void): void;
  dispatch(t: string): void;
}

interface FakeDoc {
  body: FakeEl;
  defaultView: FakeWindow;
  createElement(tag: string): FakeEl;
}

function makeEl(doc: FakeDoc, tag: string): FakeEl {
  const el: FakeEl = {
    tagName: tag.toUpperCase(),
    id: "",
    textContent: "",
    value: "",
    style: {},
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
      return c;
    },
    remove() {
      if (el.parent) {
        const i = el.parent.children.indexOf(el);
        if (i >= 0) el.parent.children.splice(i, 1);
      }
    },
    addEventListener(t, cb) {
      const arr = el.listeners.get(t) ?? [];
      arr.push(cb);
      el.listeners.set(t, arr);
    },
    dispatch(t) {
      const arr = el.listeners.get(t) ?? [];
      for (const cb of arr) cb({ stopPropagation: () => {} });
    },
  };
  return el;
}

function makeDoc(): FakeDoc {
  const doc: FakeDoc = {
    body: undefined as unknown as FakeEl,
    defaultView: { confirm: vi.fn(() => true) },
    createElement: (tag) => makeEl(doc, tag),
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

function setupWithSelectedSprite(): string {
  mapEditorStore.getState().reset({
    officeId: 1,
    tmjHash: "a".repeat(64),
    originalLayers: [],
    systemLayers: {},
    spritesLayers: {},
    layerOrder: [],
    layersVisibility: {},
  });
  mapEditorStore.getState().addLayer("sprites_overlay");
  const id = mapEditorStore.getState().addSprite("sprites_overlay", {
    x: 100,
    y: 200,
    spriteName: "cat",
    tag: null,
  });
  return id;
}

describe("MapEditorSpritePopover", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = makeDoc();
  });

  afterEach(() => {
    unmountMapEditorSpritePopover();
  });

  it("oculto si no hay selección", () => {
    mapEditorStore.getState().reset({
      officeId: 1,
      tmjHash: "a".repeat(64),
      originalLayers: [],
      systemLayers: {},
      spritesLayers: {},
      layerOrder: [],
      layersVisibility: {},
    });
    mountMapEditorSpritePopover({
      doc: doc as unknown as Document,
      getTagsForSprite: () => ["walk", "idle"],
    });
    const popover = walk(doc.body).find((e) => e.id === "map-editor-sprite-popover")!;
    expect(popover.style["display"]).toBe("none");
  });

  it("muestra id, dropdown con tags y opción default cuando hay selección", () => {
    setupWithSelectedSprite();
    mountMapEditorSpritePopover({
      doc: doc as unknown as Document,
      getTagsForSprite: () => ["walk", "idle"],
    });
    const popover = walk(doc.body).find((e) => e.id === "map-editor-sprite-popover")!;
    expect(popover.style["display"]).toBe("block");
    const allText = walk(popover)
      .map((e) => e.textContent)
      .join("\n");
    expect(allText).toContain("id: cat");

    const select = walk(popover).find((e) => e.tagName === "SELECT")!;
    const optionTexts = select.children.map((c) => c.textContent);
    expect(optionTexts).toEqual(["(default)", "walk", "idle"]);
  });

  it("cambiar el dropdown llama a setSpriteTag con el valor", () => {
    const id = setupWithSelectedSprite();
    mountMapEditorSpritePopover({
      doc: doc as unknown as Document,
      getTagsForSprite: () => ["walk", "idle"],
    });
    const popover = walk(doc.body).find((e) => e.id === "map-editor-sprite-popover")!;
    const select = walk(popover).find((e) => e.tagName === "SELECT")!;
    select.value = "idle";
    select.dispatch("change");
    expect(
      mapEditorStore.getState().spritesLayers["sprites_overlay"]!.objects[0]!.tag,
    ).toBe("idle");
    expect(id).toBeTruthy();
  });

  it("cambiar a (default) limpia el tag", () => {
    setupWithSelectedSprite();
    mapEditorStore
      .getState()
      .setSpriteTag(mapEditorStore.getState().selection!, "idle");
    mountMapEditorSpritePopover({
      doc: doc as unknown as Document,
      getTagsForSprite: () => ["walk", "idle"],
    });
    const popover = walk(doc.body).find((e) => e.id === "map-editor-sprite-popover")!;
    const select = walk(popover).find((e) => e.tagName === "SELECT")!;
    select.value = "";
    select.dispatch("change");
    expect(
      mapEditorStore.getState().spritesLayers["sprites_overlay"]!.objects[0]!.tag,
    ).toBeNull();
  });

  it("botón Borrar llama a removeSprite tras confirmación", () => {
    const id = setupWithSelectedSprite();
    mountMapEditorSpritePopover({
      doc: doc as unknown as Document,
      getTagsForSprite: () => ["walk", "idle"],
    });
    const popover = walk(doc.body).find((e) => e.id === "map-editor-sprite-popover")!;
    const delBtn = walk(popover).find(
      (e) => e.tagName === "BUTTON" && e.textContent.includes("Borrar"),
    )!;
    delBtn.dispatch("click");
    expect(mapEditorStore.getState().spritesLayers["sprites_overlay"]!.objects).toHaveLength(0);
    expect(id).toBeTruthy();
  });

  it("se oculta de nuevo cuando se deselecciona", () => {
    setupWithSelectedSprite();
    mountMapEditorSpritePopover({
      doc: doc as unknown as Document,
      getTagsForSprite: () => ["walk"],
    });
    const popover = walk(doc.body).find((e) => e.id === "map-editor-sprite-popover")!;
    expect(popover.style["display"]).toBe("block");
    mapEditorStore.getState().selectSprite(null);
    expect(popover.style["display"]).toBe("none");
  });
});
