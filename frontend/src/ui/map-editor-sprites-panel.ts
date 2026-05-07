/**
 * Panel HTML overlay con la lista de sprites disponibles del SPRITE_MANIFEST.
 * Cada entrada es draggable; al soltar sobre el canvas, la escena llama
 * `addSprite` en el store con el id arrastrado.
 *
 * La preview es por ahora una imagen del PNG completo escalada (estática). En
 * una iteración posterior se animará leyendo `meta.frameTags[0]` del JSON
 * Aseprite y rotando background-position con CSS animation.
 */
import { SPRITE_MANIFEST } from "../render/sprite-manifest.js";
import { mapEditorStore } from "../state/map-editor.js";

let panelEl: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;

export interface SpritesPanelOpts {
  /** Si está definido, se usa para resolver paths relativos del manifest. */
  baseUrl?: string;
  doc?: Document;
  /** Llamado cuando el usuario arrastra y suelta sobre el canvas. La escena
   * recibe (spriteName, clientX, clientY) y debe traducir a worldX/worldY. */
  onDropOnCanvas?: (spriteName: string, clientX: number, clientY: number) => void;
}

let onDropCb: SpritesPanelOpts["onDropOnCanvas"] = undefined;

export function mountMapEditorSpritesPanel(opts: SpritesPanelOpts = {}): void {
  if (panelEl) return;
  const doc = opts.doc ?? document;
  const baseUrl = opts.baseUrl ?? "";
  onDropCb = opts.onDropOnCanvas;

  panelEl = doc.createElement("div");
  panelEl.id = "map-editor-sprites-panel";
  Object.assign(panelEl.style, {
    position: "fixed",
    top: "60px",
    left: "12px",
    width: "180px",
    maxHeight: "70vh",
    overflowY: "auto",
    background: "#0b0d1a",
    border: "2px solid #f5b400",
    color: "#e5e5e5",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "9px",
    padding: "8px",
    zIndex: "10001",
    boxShadow: "0 0 8px rgba(245, 180, 0, 0.3)",
  });

  const title = doc.createElement("div");
  title.textContent = "SPRITES";
  Object.assign(title.style, {
    color: "#f5b400",
    marginBottom: "8px",
    fontSize: "10px",
  });
  panelEl.appendChild(title);

  const hint = doc.createElement("div");
  hint.id = "map-editor-sprites-hint";
  Object.assign(hint.style, { fontSize: "7px", color: "#8e92a8", marginBottom: "8px" });
  panelEl.appendChild(hint);

  for (const [id, entry] of Object.entries(SPRITE_MANIFEST)) {
    panelEl.appendChild(buildSpriteRow(doc, id, entry.png, baseUrl));
  }

  doc.body.appendChild(panelEl);

  // Si el usuario arrastra sobre el canvas, dejarlo soltar.
  const game = doc.getElementById("game");
  if (game) {
    game.addEventListener("dragover", handleDragOver);
    game.addEventListener("drop", handleDrop);
  }

  refreshHint();
  unsubscribe = mapEditorStore.subscribe(refreshHint);
}

export function unmountMapEditorSpritesPanel(): void {
  unsubscribe?.();
  unsubscribe = null;
  const doc = panelEl?.ownerDocument;
  panelEl?.remove();
  panelEl = null;
  onDropCb = undefined;
  if (doc) {
    const game = doc.getElementById("game");
    if (game) {
      game.removeEventListener("dragover", handleDragOver);
      game.removeEventListener("drop", handleDrop);
    }
  }
}

function buildSpriteRow(
  doc: Document,
  id: string,
  pngPath: string,
  baseUrl: string,
): HTMLDivElement {
  const row = doc.createElement("div");
  row.dataset["spriteId"] = id;
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px",
    marginBottom: "4px",
    border: "1px solid #444",
    cursor: "grab",
    background: "#11132a",
  });
  row.draggable = true;

  const img = doc.createElement("img");
  img.src = baseUrl + pngPath;
  img.alt = id;
  Object.assign(img.style, {
    width: "32px",
    height: "32px",
    objectFit: "cover",
    objectPosition: "0 0",
    imageRendering: "pixelated",
    background: "#000",
    flexShrink: "0",
  });
  row.appendChild(img);

  const label = doc.createElement("div");
  label.textContent = id;
  Object.assign(label.style, { color: "#f5b400", flex: "1", fontSize: "8px" });
  row.appendChild(label);

  row.addEventListener("dragstart", (ev) => {
    const dt = (ev as DragEvent).dataTransfer;
    if (!dt) return;
    dt.setData("application/x-vo-sprite", id);
    dt.effectAllowed = "copy";
    const state = mapEditorStore.getState();
    if (!state.activeLayerName) {
      // Tooltip pasivo; el drop se cancelará al soltar.
      row.title = "Selecciona una capa antes de arrastrar";
    }
  });

  return row;
}

function refreshHint(): void {
  if (!panelEl) return;
  const hint = panelEl.ownerDocument.getElementById("map-editor-sprites-hint");
  if (!hint) return;
  const active = mapEditorStore.getState().activeLayerName;
  hint.textContent = active
    ? `Capa activa: ${active}\nArrastra al mapa.`
    : "Selecciona una capa para insertar sprites.";
}

function handleDragOver(ev: Event): void {
  const dragEv = ev as DragEvent;
  if (dragEv.dataTransfer?.types.includes("application/x-vo-sprite")) {
    dragEv.preventDefault();
    dragEv.dataTransfer.dropEffect = "copy";
  }
}

function handleDrop(ev: Event): void {
  const dragEv = ev as DragEvent;
  const id = dragEv.dataTransfer?.getData("application/x-vo-sprite");
  if (!id) return;
  dragEv.preventDefault();
  const state = mapEditorStore.getState();
  if (!state.activeLayerName) return;
  if (onDropCb) {
    onDropCb(id, dragEv.clientX, dragEv.clientY);
  }
}
