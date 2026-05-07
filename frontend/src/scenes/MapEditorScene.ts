/**
 * Editor online de capas (change 024).
 *
 * Carga el TMJ vía `GET /api/offices/:id/map/raw`, monta tilemap + tilesets,
 * popula `mapEditorStore` y monta los paneles overlay (CAPAS, SPRITES). Sigue
 * suscripciones al store para:
 *  - Crear/borrar/mover/retag sprites Phaser cuando muta `spritesLayers`.
 *  - Aplicar `setVisible` a las TilemapLayer/sprites cuando cambia
 *    `layersVisibility`.
 *  - Aplicar `setDepth` a TilemapLayer y sprites siguiendo `layerOrder` para que
 *    el orden visible coincida con el orden lógico.
 *
 * Pendiente en próximas tandas: select/drag/delete sobre el canvas, popover
 * de tag, undo/redo.
 */
import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";
import { preloadTiledSprites } from "../render/tiled-sprites.js";
import { SPRITE_MANIFEST } from "../render/sprite-manifest.js";
import {
  mapEditorStore,
  extractEditorStateFromTmj,
  buildPatchBody,
  type SpriteObject,
} from "../state/map-editor.js";
import {
  mountMapEditorLayersPanel,
  unmountMapEditorLayersPanel,
} from "../ui/map-editor-layers-panel.js";
import {
  mountMapEditorSpritesPanel,
  unmountMapEditorSpritesPanel,
} from "../ui/map-editor-sprites-panel.js";
import {
  mountMapEditorSpritePopover,
  unmountMapEditorSpritePopover,
} from "../ui/map-editor-sprite-popover.js";

interface OfficeBootData {
  id: number;
  tilesets: Array<{ ordinal: number; image_name: string; filename: string }>;
}

interface MapRawResponse {
  tmj: unknown;
  tmj_hash: string;
  tmj_filename: string;
}

const MAP_KEY = "editor-office";
const TILES_KEY_PREFIX = "editor-tiles";

export class MapEditorScene extends Phaser.Scene {
  private office: OfficeBootData | null = null;
  private tmj: unknown = null;
  private tmjHash: string = "";
  private spritesByEditorId = new Map<string, Phaser.GameObjects.Sprite>();
  /** Rectángulo outline que sigue al sprite seleccionado. Null si no hay selección. */
  private selectionOutline: Phaser.GameObjects.Rectangle | null = null;
  /** Estado de drag en curso. */
  private dragging: { editorId: string; startX: number; startY: number } | null = null;
  /** TilemapLayer Phaser por nombre, para aplicar visibilidad y depth. */
  private tilemapLayersByName = new Map<
    string,
    { setDepth: (d: number) => unknown; setVisible: (v: boolean) => unknown }
  >();
  private hudText: Phaser.GameObjects.Text | null = null;
  private closeBtn: Phaser.GameObjects.Text | null = null;
  private saveBtn: Phaser.GameObjects.Text | null = null;
  private discardBtn: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private onClose: (() => void) | null = null;
  private storeUnsub: (() => void) | null = null;
  private mainCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private isSaving = false;

  constructor() {
    super({ key: "MapEditorScene" });
  }

  init(data: { office?: OfficeBootData; onClose?: () => void }): void {
    this.office = data.office ?? null;
    this.onClose = data.onClose ?? null;
    this.tmj = null;
    this.tmjHash = "";
    this.spritesByEditorId = new Map();
    this.tilemapLayersByName = new Map();
    this.isSaving = false;
  }

  preload(): void {
    if (!this.office) return;
    const o = this.office;
    this.load.json(MAP_KEY, `${BASE_URL}/api/offices/${o.id}/map/raw`);
    for (const t of o.tilesets) {
      this.load.image(
        `${TILES_KEY_PREFIX}:${o.id}:${t.ordinal}`,
        `${BASE_URL}/maps/${o.id}/${t.filename}`,
      );
    }
    // Precargamos todos los Aseprites del manifest porque el editor permite
    // insertar cualquier sprite, no sólo los ya referenciados en el TMJ.
    // `preloadTiledSprites` (sección 3) sólo carga los referenciados; aquí
    // queremos también los aún-no-usados.
    for (const id of Object.keys(SPRITE_MANIFEST)) {
      const entry = SPRITE_MANIFEST[id];
      if (!entry) continue;
      if (this.textures.exists(id)) continue;
      this.load.aseprite(id, entry.png, entry.json);
    }
  }

  create(): void {
    if (!this.office) return;
    const o = this.office;

    const raw = this.cache.json.get(MAP_KEY) as MapRawResponse | undefined;
    if (!raw || typeof raw !== "object" || !("tmj" in raw)) {
      this.showError("No se pudo cargar el mapa");
      return;
    }
    this.tmj = raw.tmj;
    this.tmjHash = raw.tmj_hash;

    this.cache.tilemap.add(MAP_KEY, { format: 1, data: this.tmj });

    const tilemap = this.make.tilemap({ key: MAP_KEY });
    this.map = tilemap;
    const tilesetObjs: Phaser.Tilemaps.Tileset[] = [];
    for (const t of o.tilesets) {
      const name = t.image_name.replace(/\.[^.]+$/, "");
      const ts = tilemap.addTilesetImage(name, `${TILES_KEY_PREFIX}:${o.id}:${t.ordinal}`);
      if (ts) tilesetObjs.push(ts);
    }
    for (const layer of tilemap.layers) {
      const tl = tilemap.createLayer(layer.name, tilesetObjs);
      if (tl) this.tilemapLayersByName.set(layer.name, tl);
    }

    this.mainCamera = this.cameras.main;

    const editorState = extractEditorStateFromTmj(this.tmj);
    mapEditorStore.getState().reset({
      officeId: o.id,
      tmjHash: this.tmjHash,
      originalLayers: ((this.tmj as { layers?: unknown[] }).layers as unknown[] | undefined) ?? [],
      ...editorState,
    });

    preloadTiledSprites(this, this.tmj as never, SPRITE_MANIFEST);
    if (this.load.isLoading()) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.syncFromStore());
    } else {
      this.syncFromStore();
    }

    this.storeUnsub = mapEditorStore.subscribe(() => this.syncFromStore());

    this.mountHud();
    this.mountPanels();
    this.mountCanvasInput();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private syncFromStore(): void {
    const state = mapEditorStore.getState();
    const { spritesLayers, layerOrder, layersVisibility } = state;

    // Nota: las anims Aseprite ya no se registran globalmente — se crean por
    // sprite Phaser cuando se construye con `createSpriteFromObject`.

    // 1) Aplicar orden y visibilidad a tilemap layers (capas del sistema que
    //    son tilelayers — los object layers del sistema no tienen
    //    representación visual en Phaser por ahora).
    for (let i = 0; i < layerOrder.length; i++) {
      const name = layerOrder[i]!;
      const tl = this.tilemapLayersByName.get(name);
      if (tl) {
        tl.setDepth(i);
        tl.setVisible(layersVisibility[name] ?? true);
      }
    }

    // 2) Sincronizar sprites Phaser con el estado del store.
    const aliveIds = new Set<string>();
    for (let i = 0; i < layerOrder.length; i++) {
      const name = layerOrder[i]!;
      const layer = spritesLayers[name];
      if (!layer) continue;
      const visible = layersVisibility[name] ?? true;
      const depth = i;
      for (const obj of layer.objects) {
        aliveIds.add(obj.editorId);
        let sprite = this.spritesByEditorId.get(obj.editorId);
        if (!sprite) {
          const created = this.createSpriteFromObject(obj);
          if (!created) continue;
          sprite = created;
          this.spritesByEditorId.set(obj.editorId, sprite);
        }
        sprite.setPosition(obj.x, obj.y);
        sprite.setDepth(depth);
        sprite.setVisible(visible);
        this.applyTagToSprite(sprite, obj);
      }
    }

    for (const [id, sprite] of this.spritesByEditorId) {
      if (!aliveIds.has(id)) {
        sprite.destroy();
        this.spritesByEditorId.delete(id);
      }
    }

    // 3) Refrescar HUD y outline de selección.
    this.refreshHudButtons();
    this.refreshSelectionOutline();
  }

  private createSpriteFromObject(obj: SpriteObject): Phaser.GameObjects.Sprite | null {
    const entry = SPRITE_MANIFEST[obj.spriteName];
    if (!entry) {
      console.warn(`[MapEditor] sprite "${obj.spriteName}" no está en el manifest`);
      return null;
    }
    if (!this.textures.exists(obj.spriteName)) {
      console.warn(
        `[MapEditor] textura "${obj.spriteName}" no cargada — Aseprite no llegó a entrar en cache`,
      );
      return null;
    }
    const sprite = this.add.sprite(obj.x, obj.y, obj.spriteName);
    // Registramos las anims Aseprite COMO PROPIAS del sprite (segundo arg
    // `target`) en lugar de globales. Si las creamos en `this.anims` con la
    // key del frameTag (ej. "idle"), dos sprites distintos con el mismo tag
    // colisionan: el segundo no se registra y al hacer `play("idle")` el
    // engine reproduce los frames del primero. Anim por sprite = anim
    // aislada.
    if (this.cache.json.has(obj.spriteName)) {
      this.anims.createFromAseprite(obj.spriteName, undefined, sprite);
    } else {
      console.warn(
        `[MapEditor] JSON Aseprite "${obj.spriteName}" aún no en cache; el sprite se crea sin animación`,
      );
    }
    sprite.setInteractive({ useHandCursor: true });
    sprite.setData("editorId", obj.editorId);
    sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handleSpriteClick(obj.editorId, pointer);
    });
    return sprite;
  }

  private applyTagToSprite(sprite: Phaser.GameObjects.Sprite, obj: SpriteObject): void {
    const entry = SPRITE_MANIFEST[obj.spriteName];
    const tag = obj.tag ?? entry?.defaultTag;
    if (!tag) return;
    // Las anims viven en el propio sprite (createFromAseprite con target).
    if (!sprite.anims.exists(tag)) return;
    const anim = sprite.anims.get(tag);
    const firstFrameDuration = (anim as unknown as { frames?: Array<{ duration?: number }> })
      .frames?.[0]?.duration;
    if (typeof firstFrameDuration !== "number") {
      console.warn(
        `[MapEditor] anim "${tag}" para "${obj.spriteName}" sin frames válidos; salto play`,
      );
      return;
    }
    const currentKey = sprite.anims.currentAnim?.key;
    if (currentKey === tag && sprite.anims.isPlaying) return;
    try {
      sprite.play({ key: tag, repeat: -1 }, true);
    } catch (err) {
      console.warn(`[MapEditor] no se pudo reproducir tag "${tag}" en "${obj.spriteName}":`, err);
    }
  }

  private mountPanels(): void {
    if (!this.tmj || !this.office) return;
    mountMapEditorLayersPanel({});
    mountMapEditorSpritesPanel({
      baseUrl: BASE_URL,
      onDropOnCanvas: (spriteName, clientX, clientY) =>
        this.handleSpriteDrop(spriteName, clientX, clientY),
    });
    mountMapEditorSpritePopover({
      getTagsForSprite: (spriteName) => this.getFrameTagsForSprite(spriteName),
    });
  }

  private getFrameTagsForSprite(spriteName: string): string[] {
    interface AsepriteJsonMeta {
      meta?: { frameTags?: Array<{ name: string }> };
    }
    const json = this.cache.json.get(spriteName) as AsepriteJsonMeta | undefined;
    return json?.meta?.frameTags?.map((t) => t.name) ?? [];
  }

  private handleSpriteDrop(spriteName: string, clientX: number, clientY: number): void {
    const cam = this.mainCamera ?? this.cameras.main;
    if (!cam) return;
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = cam.scrollX + localX / cam.zoom;
    const worldY = cam.scrollY + localY / cam.zoom;
    const state = mapEditorStore.getState();
    const layerName = state.activeLayerName;
    if (!layerName) return;
    state.addSprite(layerName, {
      x: Math.round(worldX),
      y: Math.round(worldY),
      spriteName,
      tag: null,
    });
  }

  private mountHud(): void {
    this.hudText = this.add
      .text(8, 8, "EDITOR DE SPRITES", {
        fontFamily: '"Press Start 2P"',
        fontSize: "10px",
        color: "#36e36c",
      })
      .setScrollFactor(0)
      .setDepth(10000);

    this.closeBtn = this.add
      .text(8, 28, "[X] CERRAR", {
        fontFamily: '"Press Start 2P"',
        fontSize: "10px",
        color: "#ff5c5c",
        backgroundColor: "#000000",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(10000)
      .setInteractive({ useHandCursor: true });
    this.closeBtn.on("pointerdown", () => this.handleClose());

    this.saveBtn = this.add
      .text(120, 28, "GUARDAR", {
        fontFamily: '"Press Start 2P"',
        fontSize: "10px",
        color: "#36e36c",
        backgroundColor: "#000000",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(10000)
      .setInteractive({ useHandCursor: true });
    this.saveBtn.on("pointerdown", () => void this.handleSave());

    this.discardBtn = this.add
      .text(220, 28, "DESCARTAR", {
        fontFamily: '"Press Start 2P"',
        fontSize: "10px",
        color: "#f5b400",
        backgroundColor: "#000000",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(10000)
      .setInteractive({ useHandCursor: true });
    this.discardBtn.on("pointerdown", () => this.handleDiscard());

    this.statusText = this.add
      .text(340, 28, "", {
        fontFamily: '"Press Start 2P"',
        fontSize: "9px",
        color: "#8e92a8",
        backgroundColor: "#000000",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(10000);

    this.input.keyboard?.on("keydown-ESC", () => this.handleClose());
    this.refreshHudButtons();
  }

  private refreshHudButtons(): void {
    if (!this.saveBtn || !this.discardBtn) return;
    const dirty = mapEditorStore.getState().isDirty;
    const saving = this.isSaving;
    if (saving) {
      this.saveBtn.setColor("#444").setAlpha(0.5);
      this.discardBtn.setColor("#444").setAlpha(0.5);
      this.statusText?.setText("Guardando...");
      return;
    }
    if (dirty) {
      this.saveBtn.setColor("#36e36c").setAlpha(1);
      this.discardBtn.setColor("#f5b400").setAlpha(1);
      this.statusText?.setText("Cambios sin guardar");
    } else {
      this.saveBtn.setColor("#444").setAlpha(0.4);
      this.discardBtn.setColor("#444").setAlpha(0.4);
      this.statusText?.setText("Sincronizado");
    }
  }

  private async handleSave(): Promise<void> {
    const state = mapEditorStore.getState();
    if (!state.isDirty || this.isSaving || !this.office) return;
    this.isSaving = true;
    this.refreshHudButtons();
    try {
      const body = buildPatchBody();
      const res = await fetch(`${BASE_URL}/api/offices/${this.office.id}/map/sprites-layers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.status === 200) {
        const data = (await res.json()) as { tmj_hash: string };
        mapEditorStore.getState().markSaved(data.tmj_hash);
        this.tmjHash = data.tmj_hash;
        this.statusText?.setText("Guardado").setColor("#36e36c");
      } else if (res.status === 409) {
        const data = (await res.json()) as { current_hash?: string };
        const reload = window.confirm(
          "Otro admin guardó cambios mientras editabas. ¿Recargar y perder tus cambios?",
        );
        if (reload) this.handleReload();
        else {
          this.statusText
            ?.setText(`Conflicto (hash actual: ${data.current_hash?.slice(0, 8) ?? "?"})`)
            .setColor("#ff5c5c");
        }
      } else {
        const errBody = await res.text();
        this.statusText?.setText(`Error ${String(res.status)}`).setColor("#ff5c5c");
        console.warn("Error guardando", res.status, errBody);
      }
    } catch (err) {
      this.statusText?.setText("Error de red").setColor("#ff5c5c");
      console.warn(err);
    } finally {
      this.isSaving = false;
      this.refreshHudButtons();
    }
  }

  private handleDiscard(): void {
    const state = mapEditorStore.getState();
    if (!state.isDirty) return;
    if (!window.confirm("¿Descartar todos los cambios y recargar el TMJ?")) return;
    this.handleReload();
  }

  private handleReload(): void {
    if (this.onClose) {
      // La forma más fiable de "recargar" sin reescribir lógica es restartear
      // la escena completa. El padre re-arranca con el TMJ fresco.
      this.scene.restart();
    } else {
      this.scene.restart();
    }
  }

  private handleClose(): void {
    const state = mapEditorStore.getState();
    if (state.isDirty) {
      if (!window.confirm("Hay cambios sin guardar. ¿Salir y perderlos?")) return;
    }
    if (this.onClose) {
      this.onClose();
    } else {
      this.scene.stop();
    }
  }

  private showError(msg: string): void {
    this.add
      .text(8, 8, msg, {
        fontFamily: '"Press Start 2P"',
        fontSize: "10px",
        color: "#ff5c5c",
      })
      .setScrollFactor(0)
      .setDepth(10000);
  }

  private mountCanvasInput(): void {
    // Click sobre vacío deselecciona.
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, currentlyOver: unknown[]) => {
      if (this.dragging) return;
      if (currentlyOver.length === 0) {
        mapEditorStore.getState().selectSprite(null);
        this.refreshSelectionOutline();
      }
      // Anotar para detección de click vs drag
      void pointer;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const sprite = this.spritesByEditorId.get(this.dragging.editorId);
      if (!sprite) return;
      const shift = pointer.event.shiftKey;
      const tw = this.map?.tileWidth ?? 1;
      const th = this.map?.tileHeight ?? 1;
      const x = shift ? Math.round(pointer.worldX / tw) * tw : Math.round(pointer.worldX);
      const y = shift ? Math.round(pointer.worldY / th) * th : Math.round(pointer.worldY);
      sprite.setPosition(x, y);
      this.refreshSelectionOutline();
    });

    this.input.on("pointerup", () => {
      if (!this.dragging) return;
      const sprite = this.spritesByEditorId.get(this.dragging.editorId);
      if (sprite) {
        // Sólo persistir al store si la posición cambió respecto al inicio.
        const finalX = Math.round(sprite.x);
        const finalY = Math.round(sprite.y);
        if (finalX !== this.dragging.startX || finalY !== this.dragging.startY) {
          mapEditorStore.getState().moveSprite(this.dragging.editorId, finalX, finalY);
        }
      }
      this.dragging = null;
    });

    this.input.keyboard?.on("keydown-DELETE", () => this.handleDeleteSelection());
    this.input.keyboard?.on("keydown-BACKSPACE", () => this.handleDeleteSelection());
  }

  private handleSpriteClick(editorId: string, pointer: Phaser.Input.Pointer): void {
    mapEditorStore.getState().selectSprite(editorId);
    const sprite = this.spritesByEditorId.get(editorId);
    if (!sprite) return;
    this.dragging = {
      editorId,
      startX: Math.round(sprite.x),
      startY: Math.round(sprite.y),
    };
    this.refreshSelectionOutline();
    void pointer;
  }

  private handleDeleteSelection(): void {
    const id = mapEditorStore.getState().selection;
    if (!id) return;
    if (!window.confirm("¿Borrar el sprite seleccionado?")) return;
    mapEditorStore.getState().removeSprite(id);
    this.refreshSelectionOutline();
  }

  private refreshSelectionOutline(): void {
    const id = mapEditorStore.getState().selection;
    if (!id) {
      this.selectionOutline?.destroy();
      this.selectionOutline = null;
      return;
    }
    const sprite = this.spritesByEditorId.get(id);
    if (!sprite) {
      this.selectionOutline?.destroy();
      this.selectionOutline = null;
      return;
    }
    if (!this.selectionOutline) {
      this.selectionOutline = this.add.rectangle(0, 0, 8, 8);
      this.selectionOutline.setStrokeStyle(2, 0x5cf6ff, 1);
      this.selectionOutline.setFillStyle(0x000000, 0);
    }
    this.selectionOutline.setPosition(sprite.x, sprite.y);
    this.selectionOutline.setSize(sprite.displayWidth, sprite.displayHeight);
    this.selectionOutline.setDepth(sprite.depth + 0.5);
  }

  private cleanup(): void {
    this.storeUnsub?.();
    this.storeUnsub = null;
    unmountMapEditorLayersPanel();
    unmountMapEditorSpritesPanel();
    unmountMapEditorSpritePopover();
    this.selectionOutline?.destroy();
    this.selectionOutline = null;
    this.dragging = null;
    for (const s of this.spritesByEditorId.values()) s.destroy();
    this.spritesByEditorId.clear();
    this.tilemapLayersByName.clear();
    this.hudText?.destroy();
    this.hudText = null;
    this.closeBtn?.destroy();
    this.closeBtn = null;
    this.saveBtn?.destroy();
    this.saveBtn = null;
    this.discardBtn?.destroy();
    this.discardBtn = null;
    this.statusText?.destroy();
    this.statusText = null;
  }

  /** Hash del TMJ tal como se cargó en `create()`. Útil para futuros PATCH. */
  getTmjHash(): string {
    return this.tmjHash;
  }
}
