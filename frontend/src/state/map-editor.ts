/**
 * Estado del editor online de capas (change 024).
 *
 * El editor mantiene una vista del TMJ separada en:
 *  - `systemLayers`: capas no-`sprites_*` del TMJ original (tilelayers, desks,
 *    voice_rooms, npcs). El editor NO modifica su contenido, sólo su orden y
 *    visibilidad. Se almacenan tal cual venían (objeto opaco).
 *  - `spritesLayers`: capas `sprites_*` editables. Se pueden crear, borrar,
 *    renombrar, reordenar y modificar sus objetos.
 *  - `layerOrder`: array con TODOS los nombres de capa (sistema + sprites_*) en
 *    el orden visible. Es la fuente de verdad del orden.
 *  - `layersVisibility`: toggles de visibilidad por nombre (true por defecto).
 *
 * Al guardar, el cliente envía:
 *  { expected_hash, layer_order, sprites_layers, layers_visibility }
 *
 * Sprite ids son strings con prefijo `sp_` + counter local (no mezclar con el
 * `id` numérico de Tiled).
 */
import { createStore } from "zustand/vanilla";

export interface SpriteObject {
  /** Id local efímero del editor (no es el `id` numérico de Tiled). */
  editorId: string;
  /** Id numérico de Tiled si el objeto venía del TMJ original; null si es nuevo. */
  tiledId: number | null;
  x: number;
  y: number;
  /** Nombre del sprite en SPRITE_MANIFEST (property `sprite` del Point). */
  spriteName: string;
  /** Tag de animación opcional (property `tag`). */
  tag: string | null;
}

export interface SpritesLayerState {
  name: string;
  objects: SpriteObject[];
}

export interface SystemLayerInfo {
  /** Snapshot del objeto original tal cual venía en el TMJ. */
  raw: Record<string, unknown>;
  /** "tilelayer" / "objectgroup" / "imagelayer" — para mostrarlo en UI. */
  type: string;
}

export interface MapEditorState {
  officeId: number | null;
  tmjHash: string;
  /** Snapshot completo de tmj.layers original (para volver al estado inicial). */
  originalLayers: unknown[];
  /** Capas del sistema indexadas por nombre. NO se mutan en el editor. */
  systemLayers: Record<string, SystemLayerInfo>;
  /** Capas sprites_* editables, indexadas por nombre. */
  spritesLayers: Record<string, SpritesLayerState>;
  /** Orden visible de TODAS las capas. */
  layerOrder: string[];
  /** Visibilidad por capa. true por defecto si una capa no está aquí. */
  layersVisibility: Record<string, boolean>;
  /** Visibilidad inicial al cargar; usada para calcular el delta a enviar. */
  initialVisibility: Record<string, boolean>;
  selection: string | null;
  activeLayerName: string | null;
  isDirty: boolean;

  reset: (init: {
    officeId: number;
    tmjHash: string;
    originalLayers: unknown[];
    systemLayers: Record<string, SystemLayerInfo>;
    spritesLayers: Record<string, SpritesLayerState>;
    layerOrder: string[];
    layersVisibility: Record<string, boolean>;
  }) => void;

  // --- capas sprites_* ---
  addLayer: (name: string) => { ok: true } | { ok: false; reason: "invalid_name" | "duplicate" };
  removeLayer: (name: string) => void;
  renameLayer: (
    oldName: string,
    newName: string,
  ) => { ok: true } | { ok: false; reason: "invalid_name" | "duplicate" | "not_found" };
  setActiveLayer: (name: string | null) => void;

  // --- orden + visibilidad (aplica a TODAS las capas) ---
  moveLayer: (name: string, delta: -1 | 1) => void;
  toggleLayerVisibility: (name: string) => void;

  // --- sprites ---
  addSprite: (layerName: string, sprite: Omit<SpriteObject, "editorId" | "tiledId">) => string;
  moveSprite: (editorId: string, x: number, y: number) => void;
  removeSprite: (editorId: string) => void;
  setSpriteTag: (editorId: string, tag: string | null) => void;
  selectSprite: (editorId: string | null) => void;

  // --- estado externo ---
  markSaved: (newHash: string) => void;

  // --- snapshot/restore para undo (sección 7) ---
  snapshot: () => MapEditorSnapshot;
  restore: (snap: MapEditorSnapshot) => void;
}

export interface MapEditorSnapshot {
  spritesLayers: Record<string, SpritesLayerState>;
  layerOrder: string[];
  layersVisibility: Record<string, boolean>;
  selection: string | null;
  activeLayerName: string | null;
  isDirty: boolean;
}

const SPRITES_LAYER_NAME_REGEX = /^sprites_[a-z0-9_]+$/;

let editorIdCounter = 0;
function nextEditorId(): string {
  editorIdCounter++;
  return `sp_${editorIdCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

function deepCloneSpritesLayers(
  layers: Record<string, SpritesLayerState>,
): Record<string, SpritesLayerState> {
  const out: Record<string, SpritesLayerState> = {};
  for (const [k, l] of Object.entries(layers)) {
    out[k] = { name: l.name, objects: l.objects.map((o) => ({ ...o })) };
  }
  return out;
}

export const mapEditorStore = createStore<MapEditorState>()((set, get) => ({
  officeId: null,
  tmjHash: "",
  originalLayers: [],
  systemLayers: {},
  spritesLayers: {},
  layerOrder: [],
  layersVisibility: {},
  initialVisibility: {},
  selection: null,
  activeLayerName: null,
  isDirty: false,

  reset: (init) => {
    const firstSpritesLayer = init.layerOrder.find((n) => n.startsWith("sprites_"));
    set({
      officeId: init.officeId,
      tmjHash: init.tmjHash,
      originalLayers: init.originalLayers,
      systemLayers: init.systemLayers,
      spritesLayers: deepCloneSpritesLayers(init.spritesLayers),
      layerOrder: [...init.layerOrder],
      layersVisibility: { ...init.layersVisibility },
      initialVisibility: { ...init.layersVisibility },
      selection: null,
      activeLayerName: firstSpritesLayer ?? null,
      isDirty: false,
    });
  },

  addLayer: (name) => {
    if (!SPRITES_LAYER_NAME_REGEX.test(name)) return { ok: false, reason: "invalid_name" };
    const { spritesLayers, layerOrder, layersVisibility } = get();
    if (spritesLayers[name] || layerOrder.includes(name)) {
      return { ok: false, reason: "duplicate" };
    }
    set({
      spritesLayers: { ...spritesLayers, [name]: { name, objects: [] } },
      layerOrder: [...layerOrder, name],
      layersVisibility: { ...layersVisibility, [name]: true },
      activeLayerName: name,
      isDirty: true,
    });
    return { ok: true };
  },

  removeLayer: (name) => {
    const state = get();
    if (!state.spritesLayers[name]) return;
    const { [name]: removed, ...restSpritesLayers } = state.spritesLayers;
    const { [name]: _v, ...restVis } = state.layersVisibility;
    void _v;
    void removed;
    const newOrder = state.layerOrder.filter((n) => n !== name);
    const removedSelection =
      state.selection !== null && removed?.objects.some((o) => o.editorId === state.selection);
    set({
      spritesLayers: restSpritesLayers,
      layerOrder: newOrder,
      layersVisibility: restVis,
      activeLayerName:
        state.activeLayerName === name
          ? (newOrder.find((n) => n.startsWith("sprites_")) ?? null)
          : state.activeLayerName,
      selection: removedSelection ? null : state.selection,
      isDirty: true,
    });
  },

  renameLayer: (oldName, newName) => {
    if (!SPRITES_LAYER_NAME_REGEX.test(newName)) return { ok: false, reason: "invalid_name" };
    const state = get();
    if (!state.spritesLayers[oldName]) return { ok: false, reason: "not_found" };
    if (oldName !== newName && state.layerOrder.includes(newName)) {
      return { ok: false, reason: "duplicate" };
    }
    if (oldName === newName) return { ok: true };

    const { [oldName]: layer, ...restSpritesLayers } = state.spritesLayers;
    const { [oldName]: visOld, ...restVis } = state.layersVisibility;
    set({
      spritesLayers: { ...restSpritesLayers, [newName]: { ...layer!, name: newName } },
      layerOrder: state.layerOrder.map((n) => (n === oldName ? newName : n)),
      layersVisibility: { ...restVis, [newName]: visOld ?? true },
      activeLayerName: state.activeLayerName === oldName ? newName : state.activeLayerName,
      isDirty: true,
    });
    return { ok: true };
  },

  moveLayer: (name, delta) => {
    const { layerOrder } = get();
    const idx = layerOrder.indexOf(name);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= layerOrder.length) return;
    const newOrder = [...layerOrder];
    const [item] = newOrder.splice(idx, 1);
    newOrder.splice(newIdx, 0, item!);
    set({ layerOrder: newOrder, isDirty: true });
  },

  toggleLayerVisibility: (name) => {
    const { layersVisibility, layerOrder } = get();
    if (!layerOrder.includes(name)) return;
    const current = layersVisibility[name] ?? true;
    set({
      layersVisibility: { ...layersVisibility, [name]: !current },
      isDirty: true,
    });
  },

  setActiveLayer: (name) => set({ activeLayerName: name }),

  addSprite: (layerName, sprite) => {
    const editorId = nextEditorId();
    const { spritesLayers } = get();
    const layer = spritesLayers[layerName];
    if (!layer) return editorId;
    set({
      spritesLayers: {
        ...spritesLayers,
        [layerName]: {
          ...layer,
          objects: [...layer.objects, { ...sprite, editorId, tiledId: null }],
        },
      },
      selection: editorId,
      isDirty: true,
    });
    return editorId;
  },

  moveSprite: (editorId, x, y) => {
    const { spritesLayers } = get();
    const updated: Record<string, SpritesLayerState> = {};
    for (const [k, l] of Object.entries(spritesLayers)) {
      updated[k] = {
        ...l,
        objects: l.objects.map((o) => (o.editorId === editorId ? { ...o, x, y } : o)),
      };
    }
    set({ spritesLayers: updated, isDirty: true });
  },

  removeSprite: (editorId) => {
    const { spritesLayers, selection } = get();
    const updated: Record<string, SpritesLayerState> = {};
    for (const [k, l] of Object.entries(spritesLayers)) {
      updated[k] = { ...l, objects: l.objects.filter((o) => o.editorId !== editorId) };
    }
    set({
      spritesLayers: updated,
      selection: selection === editorId ? null : selection,
      isDirty: true,
    });
  },

  setSpriteTag: (editorId, tag) => {
    const { spritesLayers } = get();
    const updated: Record<string, SpritesLayerState> = {};
    for (const [k, l] of Object.entries(spritesLayers)) {
      updated[k] = {
        ...l,
        objects: l.objects.map((o) => (o.editorId === editorId ? { ...o, tag } : o)),
      };
    }
    set({ spritesLayers: updated, isDirty: true });
  },

  selectSprite: (editorId) => set({ selection: editorId }),

  markSaved: (newHash) => {
    const { layersVisibility } = get();
    set({
      tmjHash: newHash,
      isDirty: false,
      // Tras guardar, el snapshot inicial pasa a ser el actual.
      initialVisibility: { ...layersVisibility },
    });
  },

  snapshot: () => {
    const { spritesLayers, layerOrder, layersVisibility, selection, activeLayerName, isDirty } =
      get();
    return {
      spritesLayers: deepCloneSpritesLayers(spritesLayers),
      layerOrder: [...layerOrder],
      layersVisibility: { ...layersVisibility },
      selection,
      activeLayerName,
      isDirty,
    };
  },

  restore: (snap) => {
    set({
      spritesLayers: deepCloneSpritesLayers(snap.spritesLayers),
      layerOrder: [...snap.layerOrder],
      layersVisibility: { ...snap.layersVisibility },
      selection: snap.selection,
      activeLayerName: snap.activeLayerName,
      isDirty: snap.isDirty,
    });
  },
}));

/**
 * Extrae el estado inicial del editor a partir de un TMJ recién cargado.
 * Devuelve la estructura esperada por `reset`.
 */
export function extractEditorStateFromTmj(tmj: unknown): {
  systemLayers: Record<string, SystemLayerInfo>;
  spritesLayers: Record<string, SpritesLayerState>;
  layerOrder: string[];
  layersVisibility: Record<string, boolean>;
} {
  const layers = (tmj as { layers?: Array<Record<string, unknown>> }).layers ?? [];
  const systemLayers: Record<string, SystemLayerInfo> = {};
  const spritesLayers: Record<string, SpritesLayerState> = {};
  const layerOrder: string[] = [];
  const layersVisibility: Record<string, boolean> = {};

  for (const l of layers) {
    const name = l["name"];
    if (typeof name !== "string") continue;
    const type = typeof l["type"] === "string" ? (l["type"] as string) : "";
    const visible = l["visible"] === false ? false : true;
    layerOrder.push(name);
    layersVisibility[name] = visible;

    if (type === "objectgroup" && name.startsWith("sprites_")) {
      const objs = (l["objects"] as Array<Record<string, unknown>> | undefined) ?? [];
      const sprites: SpriteObject[] = [];
      for (const obj of objs) {
        if (obj["point"] !== true) continue;
        const props =
          (obj["properties"] as Array<{ name: string; value: unknown }> | undefined) ?? [];
        const spriteProp = props.find((p) => p.name === "sprite");
        if (!spriteProp || typeof spriteProp.value !== "string") continue;
        const tagProp = props.find((p) => p.name === "tag");
        sprites.push({
          editorId: nextEditorId(),
          tiledId: typeof obj["id"] === "number" ? obj["id"] : null,
          x: typeof obj["x"] === "number" ? obj["x"] : 0,
          y: typeof obj["y"] === "number" ? obj["y"] : 0,
          spriteName: spriteProp.value,
          tag: tagProp && typeof tagProp.value === "string" ? tagProp.value : null,
        });
      }
      spritesLayers[name] = { name, objects: sprites };
    } else {
      systemLayers[name] = { raw: l, type };
    }
  }

  return { systemLayers, spritesLayers, layerOrder, layersVisibility };
}

/**
 * Construye el body del PATCH a partir del estado actual del store.
 * Solo incluye `layers_visibility` con las capas cuya visibilidad cambió
 * respecto al inicial.
 */
export function buildPatchBody(): {
  expected_hash: string;
  layer_order: string[];
  sprites_layers: Record<string, unknown>;
  layers_visibility?: Record<string, boolean>;
} {
  const state = mapEditorStore.getState();
  const sprites_layers: Record<string, unknown> = {};
  for (const [name, layer] of Object.entries(state.spritesLayers)) {
    sprites_layers[name] = serializeSpritesLayer(layer);
  }

  const layers_visibility: Record<string, boolean> = {};
  for (const [name, vis] of Object.entries(state.layersVisibility)) {
    if (state.initialVisibility[name] !== vis) {
      layers_visibility[name] = vis;
    }
  }

  const body: ReturnType<typeof buildPatchBody> = {
    expected_hash: state.tmjHash,
    layer_order: state.layerOrder,
    sprites_layers,
  };
  if (Object.keys(layers_visibility).length > 0) {
    body.layers_visibility = layers_visibility;
  }
  return body;
}

let nextTiledId = 1000;

function serializeSpritesLayer(layer: SpritesLayerState): Record<string, unknown> {
  return {
    name: layer.name,
    type: "objectgroup" as const,
    objects: layer.objects.map((o) => {
      const props: Array<{ name: string; type: "string"; value: string }> = [
        { name: "sprite", type: "string", value: o.spriteName },
      ];
      if (o.tag) props.push({ name: "tag", type: "string", value: o.tag });
      return {
        id: o.tiledId ?? nextTiledId++,
        point: true as const,
        x: o.x,
        y: o.y,
        properties: props,
      };
    }),
  };
}
