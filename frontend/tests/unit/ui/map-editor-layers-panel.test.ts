import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  mountMapEditorLayersPanel,
  unmountMapEditorLayersPanel,
} from "../../../src/ui/map-editor-layers-panel.js";
import { mapEditorStore } from "../../../src/state/map-editor.js";

interface FakeWindow {
  prompt: (message: string, defaultValue?: string) => string | null;
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
}

interface FakeElement {
  tagName: string;
  id: string;
  textContent: string;
  title: string;
  disabled?: boolean;
  style: Record<string, string>;
  dataset: Record<string, string>;
  children: FakeElement[];
  parent: FakeElement | null;
  ownerDocument: FakeDocument;
  innerHTML: string;
  listeners: Map<string, Array<(ev: { stopPropagation?: () => void }) => void>>;
  appendChild(child: FakeElement): FakeElement;
  remove(): void;
  addEventListener(type: string, cb: (ev: { stopPropagation?: () => void }) => void): void;
  click(): void;
}

interface FakeDocument {
  body: FakeElement;
  defaultView: FakeWindow;
  createElement(tag: string): FakeElement;
}

function makeElement(doc: FakeDocument, tag: string): FakeElement {
  const el: FakeElement = {
    tagName: tag.toUpperCase(),
    id: "",
    textContent: "",
    title: "",
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
    appendChild(child) {
      child.parent = el;
      el.children.push(child);
      return child;
    },
    remove() {
      if (el.parent) {
        const idx = el.parent.children.indexOf(el);
        if (idx >= 0) el.parent.children.splice(idx, 1);
      }
    },
    addEventListener(type, cb) {
      const arr = el.listeners.get(type) ?? [];
      arr.push(cb);
      el.listeners.set(type, arr);
    },
    click() {
      const arr = el.listeners.get("click") ?? [];
      for (const cb of arr) cb({ stopPropagation: () => {} });
    },
  };
  return el;
}

function walk(root: FakeElement): FakeElement[] {
  // BFS para mantener el orden de aparición en el DOM (children izq-a-der).
  const out: FakeElement[] = [];
  const queue: FakeElement[] = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur);
    for (const c of cur.children) queue.push(c);
  }
  return out;
}

function makeFakeDocument(window: FakeWindow): FakeDocument {
  const doc: FakeDocument = {
    body: undefined as unknown as FakeElement,
    defaultView: window,
    createElement: (tag) => makeElement(doc, tag),
  };
  doc.body = makeElement(doc, "body");
  return doc;
}

function setupWithSystemLayers() {
  mapEditorStore.getState().reset({
    officeId: 1,
    tmjHash: "a".repeat(64),
    originalLayers: [],
    systemLayers: {
      ground: { raw: { type: "tilelayer", name: "ground" }, type: "tilelayer" },
      furniture: { raw: { type: "tilelayer", name: "furniture" }, type: "tilelayer" },
      desks: { raw: { type: "objectgroup", name: "desks" }, type: "objectgroup" },
    },
    spritesLayers: {},
    layerOrder: ["ground", "furniture", "desks"],
    layersVisibility: { ground: true, furniture: true, desks: true },
  });
}

describe("MapEditorLayersPanel", () => {
  let win: FakeWindow;
  let doc: FakeDocument;

  beforeEach(() => {
    setupWithSystemLayers();
    win = { prompt: vi.fn(), alert: vi.fn(), confirm: vi.fn(() => true) };
    doc = makeFakeDocument(win);
  });

  afterEach(() => {
    unmountMapEditorLayersPanel();
  });

  it("muestra todas las capas en orden inverso a layerOrder (último arriba en el panel = encima al renderizar)", () => {
    mapEditorStore.getState().addLayer("sprites_overlay");
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });

    const rows = walk(doc.body).filter((e) => e.dataset["layerName"]);
    expect(rows.map((r) => r.dataset["layerName"])).toEqual([
      "sprites_overlay",
      "desks",
      "furniture",
      "ground",
    ]);
  });

  it("crear capa con nombre válido la añade al store y al panel", () => {
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });
    win.prompt = vi.fn(() => "sprites_floor");
    const addBtn = walk(doc.body).find(
      (e) => e.tagName === "BUTTON" && e.textContent.includes("Nueva capa"),
    );
    expect(addBtn).toBeDefined();
    addBtn!.click();
    expect(mapEditorStore.getState().layerOrder).toContain("sprites_floor");
  });

  it("renombrar capa sprites_* funciona; capas del sistema no exponen ✎", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });
    const spritesRow = walk(doc.body).find((e) => e.dataset["layerName"] === "sprites_a")!;
    const groundRow = walk(doc.body).find((e) => e.dataset["layerName"] === "ground")!;

    const renameInSprites = walk(spritesRow).find(
      (e) => e.tagName === "BUTTON" && e.textContent === "✎",
    );
    expect(renameInSprites).toBeDefined();

    const renameInSystem = walk(groundRow).find(
      (e) => e.tagName === "BUTTON" && e.textContent === "✎",
    );
    expect(renameInSystem).toBeUndefined();
  });

  it("borrar capa solo está disponible en sprites_*", () => {
    mapEditorStore.getState().addLayer("sprites_a");
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });
    const spritesRow = walk(doc.body).find((e) => e.dataset["layerName"] === "sprites_a")!;
    const groundRow = walk(doc.body).find((e) => e.dataset["layerName"] === "ground")!;

    expect(
      walk(spritesRow).some((e) => e.tagName === "BUTTON" && e.textContent === "✕"),
    ).toBe(true);
    expect(
      walk(groundRow).some((e) => e.tagName === "BUTTON" && e.textContent === "✕"),
    ).toBe(false);
  });

  it("botones ↑/↓ deshabilitados en los bordes del stack visual del panel", () => {
    // layerOrder = [ground, furniture, desks] → panel pinta [desks, furniture, ground]
    // de arriba abajo. desks está arriba → ↑ deshabilitado. ground está abajo → ↓ deshabilitado.
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });

    const desksRow = walk(doc.body).find((e) => e.dataset["layerName"] === "desks")!;
    const desksUp = walk(desksRow).find((e) => e.tagName === "BUTTON" && e.textContent === "↑")!;
    expect(desksUp.disabled).toBe(true);

    const groundRow = walk(doc.body).find((e) => e.dataset["layerName"] === "ground")!;
    const groundDown = walk(groundRow).find(
      (e) => e.tagName === "BUTTON" && e.textContent === "↓",
    )!;
    expect(groundDown.disabled).toBe(true);

    const furnitureRow = walk(doc.body).find((e) => e.dataset["layerName"] === "furniture")!;
    const furnitureUp = walk(furnitureRow).find(
      (e) => e.tagName === "BUTTON" && e.textContent === "↑",
    )!;
    expect(furnitureUp.disabled).toBe(false);
  });

  it("↑ del panel sube el índice de la capa en layerOrder (encima visualmente)", () => {
    // layerOrder inicial = [ground, furniture, desks]
    // ↑ en furniture → moveLayer(furniture, +1) → [ground, desks, furniture]
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });
    const furnitureRow = walk(doc.body).find((e) => e.dataset["layerName"] === "furniture")!;
    const upBtn = walk(furnitureRow).find((e) => e.tagName === "BUTTON" && e.textContent === "↑")!;
    upBtn.click();
    expect(mapEditorStore.getState().layerOrder).toEqual(["ground", "desks", "furniture"]);
  });

  it("toggle de visibilidad cambia el flag y el icono", () => {
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });
    const groundRow = walk(doc.body).find((e) => e.dataset["layerName"] === "ground")!;
    const visBtn = walk(groundRow).find(
      (e) => e.tagName === "BUTTON" && (e.textContent === "👁" || e.textContent === "⊘"),
    )!;
    expect(visBtn.textContent).toBe("👁");
    visBtn.click();
    expect(mapEditorStore.getState().layersVisibility["ground"]).toBe(false);
    // Tras suscripción, el panel se repinta y el icono cambia.
    const groundRow2 = walk(doc.body).find((e) => e.dataset["layerName"] === "ground")!;
    const visBtn2 = walk(groundRow2).find(
      (e) => e.tagName === "BUTTON" && (e.textContent === "👁" || e.textContent === "⊘"),
    )!;
    expect(visBtn2.textContent).toBe("⊘");
  });

  it("se repinta al cambiar layerOrder en el store", () => {
    mountMapEditorLayersPanel({ doc: doc as unknown as Document });
    expect(walk(doc.body).filter((e) => e.dataset["layerName"]).length).toBe(3);
    mapEditorStore.getState().addLayer("sprites_x");
    expect(walk(doc.body).filter((e) => e.dataset["layerName"]).length).toBe(4);
  });
});
