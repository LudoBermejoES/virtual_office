import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mountMapEditorSpritesPanel,
  unmountMapEditorSpritesPanel,
} from "../../../src/ui/map-editor-sprites-panel.js";
import { mapEditorStore } from "../../../src/state/map-editor.js";

// Helpers análogos a los del panel de capas, simplificados para no duplicar
// excesivamente.
interface FakeEl {
  tagName: string;
  id: string;
  textContent: string;
  title: string;
  src?: string;
  alt?: string;
  draggable: boolean;
  style: Record<string, string>;
  dataset: Record<string, string>;
  children: FakeEl[];
  parent: FakeEl | null;
  ownerDocument: FakeDoc;
  listeners: Map<string, Array<(ev: unknown) => void>>;
  appendChild(c: FakeEl): FakeEl;
  remove(): void;
  addEventListener(t: string, cb: (ev: unknown) => void): void;
  removeEventListener(t: string, cb: (ev: unknown) => void): void;
  dispatch(t: string, ev: unknown): void;
}

interface FakeDoc {
  body: FakeEl;
  head: FakeEl;
  defaultView: { prompt: () => null; alert: () => void; confirm: () => boolean };
  byId: Map<string, FakeEl>;
  createElement(tag: string): FakeEl;
  getElementById(id: string): FakeEl | null;
}

function makeEl(doc: FakeDoc, tag: string): FakeEl {
  const el: FakeEl = {
    tagName: tag.toUpperCase(),
    id: "",
    textContent: "",
    title: "",
    draggable: false,
    style: {},
    dataset: {},
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
      if (el.id) doc.byId.delete(el.id);
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
      for (const cb of arr) cb(ev);
    },
  };
  return el;
}

function makeDoc(): FakeDoc {
  const doc: FakeDoc = {
    body: undefined as unknown as FakeEl,
    head: undefined as unknown as FakeEl,
    defaultView: { prompt: () => null, alert: () => {}, confirm: () => true },
    byId: new Map(),
    createElement: (tag) => makeEl(doc, tag),
    getElementById(id) {
      return doc.byId.get(id) ?? null;
    },
  };
  doc.body = makeEl(doc, "body");
  doc.head = makeEl(doc, "head");
  return doc;
}

function walk(root: FakeEl): FakeEl[] {
  const out: FakeEl[] = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    for (const c of cur.children) stack.push(c);
  }
  return out;
}

function reset() {
  mapEditorStore.getState().reset({
    officeId: 1,
    tmjHash: "a".repeat(64),
    originalLayers: [],
    systemLayers: {},
    spritesLayers: {},
    layerOrder: [],
    layersVisibility: {},
  });
}

describe("MapEditorSpritesPanel", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    reset();
    doc = makeDoc();
    // Añade el div #game para que los listeners de drop se registren ahí
    const game = doc.createElement("div");
    game.id = "game";
    doc.body.appendChild(game);
  });

  afterEach(() => {
    unmountMapEditorSpritesPanel();
  });

  it("lista todas las entradas del SPRITE_MANIFEST con id y preview img", () => {
    mountMapEditorSpritesPanel({ doc: doc as unknown as Document, baseUrl: "http://x" });
    const rows = walk(doc.body).filter((e) => e.dataset["spriteId"]);
    expect(rows.length).toBeGreaterThan(0);
    const cat = rows.find((r) => r.dataset["spriteId"] === "cat");
    expect(cat).toBeDefined();
    const img = walk(cat!).find((e) => e.tagName === "IMG");
    expect(img).toBeDefined();
    expect(img!.src).toBe("http://x/sprites/cat/animated_cat_48x48.png");
  });

  it("hint indica la capa activa cuando hay alguna", () => {
    mapEditorStore.getState().addLayer("sprites_overlay");
    mountMapEditorSpritesPanel({ doc: doc as unknown as Document });
    const hint = doc.getElementById("map-editor-sprites-hint")!;
    expect(hint.textContent).toContain("sprites_overlay");
  });

  it("hint pide elegir capa cuando no hay activa", () => {
    mountMapEditorSpritesPanel({ doc: doc as unknown as Document });
    const hint = doc.getElementById("map-editor-sprites-hint")!;
    expect(hint.textContent).toMatch(/Selecciona una capa/);
  });

  it("drop sobre #game con datos válidos llama a onDropOnCanvas", () => {
    mapEditorStore.getState().addLayer("sprites_overlay");
    const onDrop = vi.fn();
    mountMapEditorSpritesPanel({
      doc: doc as unknown as Document,
      onDropOnCanvas: onDrop,
    });
    const game = doc.getElementById("game")!;
    const dt = {
      types: ["application/x-vo-sprite"],
      getData: (k: string) => (k === "application/x-vo-sprite" ? "cat" : ""),
      dropEffect: "",
    };
    game.dispatch("drop", {
      dataTransfer: dt,
      clientX: 250,
      clientY: 300,
      preventDefault: () => {},
    });
    expect(onDrop).toHaveBeenCalledWith("cat", 250, 300);
  });

  it("drop sin capa activa NO llama a onDropOnCanvas", () => {
    const onDrop = vi.fn();
    mountMapEditorSpritesPanel({
      doc: doc as unknown as Document,
      onDropOnCanvas: onDrop,
    });
    const game = doc.getElementById("game")!;
    const dt = {
      types: ["application/x-vo-sprite"],
      getData: () => "cat",
      dropEffect: "",
    };
    game.dispatch("drop", { dataTransfer: dt, clientX: 0, clientY: 0, preventDefault: () => {} });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("con getJsonForSprite, cada item tiene preview animada (div con animation CSS)", () => {
    const catJson = {
      frames: {
        "0": { frame: { x: 0, y: 0, w: 144, h: 48 }, duration: 100 },
        "1": { frame: { x: 144, y: 0, w: 144, h: 48 }, duration: 100 },
        "2": { frame: { x: 288, y: 0, w: 144, h: 48 }, duration: 100 },
      },
      meta: {
        frameTags: [{ name: "walk", from: 0, to: 2 }],
      },
    };
    mountMapEditorSpritesPanel({
      doc: doc as unknown as Document,
      baseUrl: "http://x",
      getJsonForSprite: (id) => (id === "cat" ? catJson : undefined),
    });

    // El item de cat debe tener un <div> con dataset spritePreview, no <img>
    const previews = walk(doc.body).filter((e) => e.dataset["spritePreview"] === "cat");
    expect(previews.length).toBe(1);
    expect(previews[0]!.tagName).toBe("DIV");
    expect(previews[0]!.style["animation"]).toContain("vo-sprite-anim-cat");
    expect(previews[0]!.style["animation"]).toContain("steps(3)");

    // Los keyframes están inyectados en un <style> dentro de head
    const styleEls = walk(doc.head).filter((e) => e.tagName === "STYLE");
    expect(styleEls.length).toBeGreaterThan(0);
    const css = styleEls[0]!.textContent;
    expect(css).toContain("@keyframes vo-sprite-anim-cat");
    // 3 frames de 144x48 escalados a alto 32 → ancho frame 96 → total 288.
    expect(css).toContain("-288px");
  });

  it("sin getJsonForSprite, fallback a <img> estática", () => {
    mountMapEditorSpritesPanel({ doc: doc as unknown as Document, baseUrl: "http://x" });
    const cat = walk(doc.body).find((e) => e.dataset["spriteId"] === "cat");
    const img = walk(cat!).find((e) => e.tagName === "IMG");
    expect(img).toBeDefined();
  });
});
