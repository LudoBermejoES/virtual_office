/**
 * Panel HTML overlay con la lista de sprites disponibles del SPRITE_MANIFEST.
 * Cada entrada es draggable; al soltar sobre el canvas, la escena llama
 * `addSprite` en el store con el id arrastrado.
 *
 * Preview animada (change 025): si la escena provee `getJsonForSprite`, cada
 * entrada anima el `defaultTag` reproduciendo los frames con CSS
 * `background-position` + `steps()`. Sin callback (legacy/tests), cae a una
 * imagen estática del primer frame.
 */
import { SPRITE_MANIFEST } from "../render/sprite-manifest.js";
import { mapEditorStore } from "../state/map-editor.js";
import { buildSpriteAnimationCss } from "./map-editor-sprites-panel-animation.js";
import type { SpriteAnimationCss } from "./map-editor-sprites-panel-animation.js";

let panelEl: HTMLDivElement | null = null;
let styleEl: HTMLStyleElement | null = null;
let unsubscribe: (() => void) | null = null;

export interface SpritesPanelOpts {
  /** Si está definido, se usa para resolver paths relativos del manifest. */
  baseUrl?: string;
  doc?: Document;
  /** Llamado cuando el usuario arrastra y suelta sobre el canvas. La escena
   * recibe (spriteName, clientX, clientY) y debe traducir a worldX/worldY. */
  onDropOnCanvas?: (spriteName: string, clientX: number, clientY: number) => void;
  /** Devuelve el JSON Aseprite cacheado para un sprite del manifest, o
   * undefined si aún no está disponible (la preview cae a estática). */
  getJsonForSprite?: (spriteId: string) => unknown;
}

let onDropCb: SpritesPanelOpts["onDropOnCanvas"] = undefined;
let getJsonCb: SpritesPanelOpts["getJsonForSprite"] = undefined;

export function mountMapEditorSpritesPanel(opts: SpritesPanelOpts = {}): void {
  if (panelEl) return;
  const doc = opts.doc ?? document;
  const baseUrl = opts.baseUrl ?? "";
  onDropCb = opts.onDropOnCanvas;
  getJsonCb = opts.getJsonForSprite;

  // Estilo global para inyectar los `@keyframes` de cada sprite. Lo añadimos al
  // <head> para que las reglas sean accesibles desde cualquier `animation`.
  styleEl = doc.createElement("style");
  styleEl.id = "map-editor-sprites-panel-style";
  doc.head.appendChild(styleEl);

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

  const PREVIEW_HEIGHT = 32;
  const keyframesParts: string[] = [];
  for (const [id, entry] of Object.entries(SPRITE_MANIFEST)) {
    const json = getJsonCb?.(id);
    const animCss = buildSpriteAnimationCss(json as never, entry.defaultTag, id, PREVIEW_HEIGHT);
    if (animCss) keyframesParts.push(animCss.keyframes);
    panelEl.appendChild(buildSpriteRow(doc, id, entry.png, baseUrl, animCss));
  }
  styleEl.textContent = keyframesParts.join("\n");

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
  styleEl?.remove();
  styleEl = null;
  onDropCb = undefined;
  getJsonCb = undefined;
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
  animCss: SpriteAnimationCss | null,
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

  if (animCss) {
    // Preview animada: <div> con background-image + animation CSS. Las
    // dimensiones que ponemos aquí (width, background-size) están en la MISMA
    // escala que los `@keyframes` que generó el helper, por lo que el cursor
    // de la animación recorre exactamente todo el PNG escalado y vuelve a 0.
    const preview = doc.createElement("div");
    preview.dataset["spritePreview"] = id;
    const totalWidth = animCss.frameWidthScaled * animCss.totalFrames;
    Object.assign(preview.style, {
      width: `${String(animCss.frameWidthScaled)}px`,
      height: `${String(animCss.frameHeightScaled)}px`,
      backgroundImage: `url(${baseUrl}${pngPath})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${String(totalWidth)}px ${String(animCss.frameHeightScaled)}px`,
      imageRendering: "pixelated",
      animation: animCss.animation,
      backgroundColor: "#000",
      flexShrink: "0",
    });
    row.appendChild(preview);
  } else {
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
  }

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
