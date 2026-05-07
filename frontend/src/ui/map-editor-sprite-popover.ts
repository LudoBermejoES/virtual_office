/**
 * Popover de propiedades del sprite seleccionado (change 024 sección 6).
 *
 * Aparece cuando hay `mapEditorStore.selection` y muestra:
 *  - El id (sprite name) en read-only.
 *  - Un dropdown con los frameTags del Aseprite cacheado para esa entrada del
 *    manifest, más una opción "(default)" que limpia el tag.
 *
 * Cambiar el dropdown llama a `setSpriteTag` en el store, lo que dispara la
 * suscripción de la escena y reproduce la animación elegida.
 */
import { mapEditorStore } from "../state/map-editor.js";

let popoverEl: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;
let getTagsFor: ((spriteName: string) => string[]) | null = null;

export interface MountOpts {
  /** Función que dada la id de un sprite del manifest devuelve sus frameTags. */
  getTagsForSprite: (spriteName: string) => string[];
  doc?: Document;
}

export function mountMapEditorSpritePopover(opts: MountOpts): void {
  if (popoverEl) return;
  const doc = opts.doc ?? document;
  getTagsFor = opts.getTagsForSprite;

  popoverEl = doc.createElement("div");
  popoverEl.id = "map-editor-sprite-popover";
  Object.assign(popoverEl.style, {
    position: "fixed",
    bottom: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: "240px",
    background: "#0b0d1a",
    border: "2px solid #5cf6ff",
    color: "#e5e5e5",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "9px",
    padding: "8px 10px",
    zIndex: "10001",
    boxShadow: "0 0 8px rgba(92, 246, 255, 0.4)",
    display: "none",
  });

  doc.body.appendChild(popoverEl);

  render();
  unsubscribe = mapEditorStore.subscribe(render);
}

export function unmountMapEditorSpritePopover(): void {
  unsubscribe?.();
  unsubscribe = null;
  popoverEl?.remove();
  popoverEl = null;
  getTagsFor = null;
}

function render(): void {
  if (!popoverEl || !getTagsFor) return;
  const doc = popoverEl.ownerDocument;
  const state = mapEditorStore.getState();
  const id = state.selection;

  if (!id) {
    popoverEl.style.display = "none";
    return;
  }

  // Buscar el objeto seleccionado en cualquier capa.
  let found: { spriteName: string; tag: string | null } | null = null;
  for (const layer of Object.values(state.spritesLayers)) {
    const obj = layer.objects.find((o) => o.editorId === id);
    if (obj) {
      found = { spriteName: obj.spriteName, tag: obj.tag };
      break;
    }
  }
  if (!found) {
    popoverEl.style.display = "none";
    return;
  }

  popoverEl.style.display = "block";
  popoverEl.innerHTML = "";

  const title = doc.createElement("div");
  title.textContent = "SPRITE";
  Object.assign(title.style, { color: "#5cf6ff", fontSize: "10px", marginBottom: "6px" });
  popoverEl.appendChild(title);

  const idRow = doc.createElement("div");
  idRow.textContent = `id: ${found.spriteName}`;
  Object.assign(idRow.style, { color: "#f5b400", marginBottom: "4px", fontSize: "8px" });
  popoverEl.appendChild(idRow);

  const tags = getTagsFor(found.spriteName);
  const tagRow = doc.createElement("div");
  Object.assign(tagRow.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "4px",
  });
  const tagLabel = doc.createElement("span");
  tagLabel.textContent = "tag:";
  Object.assign(tagLabel.style, { color: "#8e92a8", fontSize: "8px" });
  tagRow.appendChild(tagLabel);

  const select = doc.createElement("select");
  Object.assign(select.style, {
    background: "#11132a",
    color: "#e5e5e5",
    border: "1px solid #5cf6ff",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "2px 4px",
    flex: "1",
  });
  const defaultOpt = doc.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "(default)";
  select.appendChild(defaultOpt);
  for (const t of tags) {
    const opt = doc.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  }
  select.value = found.tag ?? "";
  select.addEventListener("change", () => {
    const next = select.value === "" ? null : select.value;
    mapEditorStore.getState().setSpriteTag(id, next);
  });
  tagRow.appendChild(select);
  popoverEl.appendChild(tagRow);

  const delBtn = doc.createElement("button");
  delBtn.textContent = "[Supr] Borrar";
  Object.assign(delBtn.style, {
    marginTop: "8px",
    width: "100%",
    background: "transparent",
    border: "1px solid #ff5c5c",
    color: "#ff5c5c",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "4px",
    cursor: "pointer",
  });
  delBtn.addEventListener("click", () => {
    if (!doc.defaultView?.confirm("¿Borrar el sprite seleccionado?")) return;
    mapEditorStore.getState().removeSprite(id);
  });
  popoverEl.appendChild(delBtn);
}
