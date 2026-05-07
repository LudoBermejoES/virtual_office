/**
 * Panel HTML overlay del editor de capas (change 024).
 *
 * Muestra TODAS las capas del TMJ (sistema + sprites_*) en una única lista
 * cuyo orden coincide con `mapEditorStore.layerOrder`. Cada fila tiene:
 *
 *  - Nombre + tipo. Sprites_* en verde, sistema en gris.
 *  - 👁 toggle visibilidad (todas).
 *  - ↑ / ↓ reordenar (todas, deshabilitado en bordes).
 *  - ✎ renombrar (solo sprites_*).
 *  - ✕ borrar (solo sprites_*, pide confirmación).
 *
 * Click sobre el nombre de una capa sprites_* la marca como activa (donde se
 * insertan los nuevos sprites desde el panel SPRITES).
 */
import { mapEditorStore } from "../state/map-editor.js";
import type { MapEditorState } from "../state/map-editor.js";

let panelEl: HTMLDivElement | null = null;
let listEl: HTMLDivElement | null = null;
let unsubscribe: (() => void) | null = null;

export interface MountOpts {
  doc?: Document;
}

export function mountMapEditorLayersPanel(_opts: MountOpts = {}): void {
  if (panelEl) return;
  const doc = _opts.doc ?? document;

  panelEl = doc.createElement("div");
  panelEl.id = "map-editor-layers-panel";
  Object.assign(panelEl.style, {
    position: "fixed",
    top: "60px",
    right: "12px",
    width: "260px",
    maxHeight: "70vh",
    overflowY: "auto",
    background: "#0b0d1a",
    border: "2px solid #36e36c",
    color: "#e5e5e5",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "9px",
    padding: "8px",
    zIndex: "10001",
    boxShadow: "0 0 8px rgba(54, 227, 108, 0.3)",
  });

  const title = doc.createElement("div");
  title.textContent = "CAPAS";
  Object.assign(title.style, {
    color: "#36e36c",
    marginBottom: "8px",
    fontSize: "10px",
  });
  panelEl.appendChild(title);

  listEl = doc.createElement("div");
  panelEl.appendChild(listEl);

  const addBtn = doc.createElement("button");
  addBtn.textContent = "+ Nueva capa sprites_*";
  Object.assign(addBtn.style, {
    marginTop: "8px",
    width: "100%",
    background: "transparent",
    border: "1px solid #36e36c",
    color: "#36e36c",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "6px",
    cursor: "pointer",
  });
  addBtn.addEventListener("click", () => handleAddLayer(doc));
  panelEl.appendChild(addBtn);

  doc.body.appendChild(panelEl);

  render();
  unsubscribe = mapEditorStore.subscribe(render);
}

export function unmountMapEditorLayersPanel(): void {
  unsubscribe?.();
  unsubscribe = null;
  panelEl?.remove();
  panelEl = null;
  listEl = null;
}

function handleAddLayer(doc: Document): void {
  const name = doc.defaultView?.prompt("Nombre de la capa (sprites_*):") ?? null;
  if (!name) return;
  const r = mapEditorStore.getState().addLayer(name);
  if (!r.ok) {
    if (r.reason === "invalid_name") {
      doc.defaultView?.alert("Nombre inválido. Debe ser sprites_<letras_minúsculas_y_números>.");
    } else if (r.reason === "duplicate") {
      doc.defaultView?.alert("Ya existe una capa con ese nombre.");
    }
  }
}

function render(): void {
  if (!listEl) return;
  const doc = listEl.ownerDocument;
  const state = mapEditorStore.getState();

  listEl.innerHTML = "";

  // Convención del panel: la fila de ARRIBA = la capa que se pinta ENCIMA
  // (mayor depth en Phaser, mayor índice en `layerOrder`). Por eso recorremos
  // el array al revés: layerOrder[N-1] arriba, layerOrder[0] abajo. Esto hace
  // que el botón ↑ siempre signifique "subir el sprite encima del resto",
  // como en Tiled/Photoshop.
  for (let i = state.layerOrder.length - 1; i >= 0; i--) {
    const name = state.layerOrder[i]!;
    const isTopOfStack = i === state.layerOrder.length - 1;
    const isBottomOfStack = i === 0;
    // ↑ en el panel = mover hacia arriba visualmente = subir índice en
    // layerOrder. ↓ = bajar índice. Por eso `disableUp` cuando ya está arriba
    // del stack y `disableDown` cuando ya está abajo.
    listEl.appendChild(renderRow(doc, name, state, isTopOfStack, isBottomOfStack));
  }
}

function renderRow(
  doc: Document,
  name: string,
  state: MapEditorState,
  disableUp: boolean,
  disableDown: boolean,
): HTMLDivElement {
  const isSprites = name.startsWith("sprites_");
  const isActive = state.activeLayerName === name;
  const visible = state.layersVisibility[name] ?? true;
  const accent = isSprites ? "#36e36c" : "#8e92a8";
  const layerInfo = isSprites
    ? { type: "sprites", count: state.spritesLayers[name]?.objects.length ?? 0 }
    : { type: state.systemLayers[name]?.type ?? "system", count: -1 };

  const row = doc.createElement("div");
  row.dataset["layerName"] = name;
  Object.assign(row.style, {
    padding: "6px 6px",
    marginBottom: "2px",
    color: isActive ? "#0b0d1a" : accent,
    background: isActive ? accent : "transparent",
    borderLeft: `3px solid ${accent}`,
    fontSize: "8px",
    cursor: isSprites ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    gap: "3px",
    opacity: visible ? "1" : "0.5",
  });

  const labelWrap = doc.createElement("div");
  labelWrap.style.flex = "1";
  labelWrap.style.minWidth = "0";
  labelWrap.style.overflow = "hidden";
  labelWrap.style.textOverflow = "ellipsis";
  const label =
    layerInfo.count >= 0 ? `${name} (${String(layerInfo.count)})` : `${name} [${layerInfo.type}]`;
  labelWrap.textContent = label;
  if (isSprites) {
    labelWrap.addEventListener("click", () => {
      mapEditorStore.getState().setActiveLayer(name);
    });
  }
  row.appendChild(labelWrap);

  // En filas activas el fondo es `accent`, así que los botones invierten su
  // color para contrastar (border y color en negro/oscuro). En el resto, los
  // botones usan `accent` como border + color sobre fondo transparente.
  const btnColor = isActive ? "#0b0d1a" : accent;

  const visBtn = makeIconButton(
    doc,
    visible ? "👁" : "⊘",
    visible ? "Ocultar" : "Mostrar",
    btnColor,
    false,
  );
  visBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    mapEditorStore.getState().toggleLayerVisibility(name);
  });
  row.appendChild(visBtn);

  // ↑ en el panel = subir visualmente = mayor índice en layerOrder = +1.
  const upBtn = makeIconButton(doc, "↑", "Subir", btnColor, disableUp);
  upBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (upBtn.disabled) return;
    mapEditorStore.getState().moveLayer(name, +1);
  });
  row.appendChild(upBtn);

  // ↓ en el panel = bajar visualmente = menor índice en layerOrder = -1.
  const downBtn = makeIconButton(doc, "↓", "Bajar", btnColor, disableDown);
  downBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (downBtn.disabled) return;
    mapEditorStore.getState().moveLayer(name, -1);
  });
  row.appendChild(downBtn);

  if (isSprites) {
    const renameBtn = makeIconButton(doc, "✎", "Renombrar", btnColor, false);
    renameBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const newName = doc.defaultView?.prompt("Nuevo nombre (sprites_*):", name);
      if (!newName || newName === name) return;
      const r = mapEditorStore.getState().renameLayer(name, newName);
      if (!r.ok) {
        doc.defaultView?.alert(`No se pudo renombrar: ${r.reason}`);
      }
    });
    row.appendChild(renameBtn);

    const delBtn = makeIconButton(doc, "✕", "Borrar", btnColor, false);
    delBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const layer = mapEditorStore.getState().spritesLayers[name];
      const count = layer?.objects.length ?? 0;
      if (doc.defaultView?.confirm(`Borrar la capa "${name}" y sus ${String(count)} sprites?`)) {
        mapEditorStore.getState().removeLayer(name);
      }
    });
    row.appendChild(delBtn);
  }

  return row;
}

function makeIconButton(
  doc: Document,
  label: string,
  title: string,
  color: string,
  disabled: boolean,
): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.textContent = label;
  btn.title = disabled ? `${title} (no disponible)` : title;
  btn.disabled = disabled;
  Object.assign(btn.style, {
    background: "transparent",
    border: `1px solid ${color}`,
    color: disabled ? "#444" : color,
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "2px 4px",
    cursor: disabled ? "not-allowed" : "pointer",
    minWidth: "20px",
    opacity: disabled ? "0.4" : "1",
  });
  return btn;
}
