import * as Phaser from "phaser";
import { validateDeskPlacement } from "@virtual-office/shared";
import { drawDesk } from "../render/desk-renderer.js";
import { BASE_URL } from "../config.js";

interface OfficeData {
  id: number;
  tmj_filename: string;
  tile_width: number;
  tile_height: number;
  map_width: number;
  map_height: number;
  tilesets: Array<{ ordinal: number; image_name: string; filename: string }>;
}

interface DeskData {
  id: number;
  label: string;
  x: number;
  y: number;
  source: "manual" | "tiled";
}

export class AdminMapScene extends Phaser.Scene {
  private office: OfficeData | null = null;
  private desks: DeskData[] = [];
  private deskRects: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private selectedId: number | null = null;
  private placing = false;
  private placingPreview: Phaser.GameObjects.Rectangle | null = null;
  private hudText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "AdminMapScene" });
  }

  init(data: { office?: OfficeData; desks?: DeskData[] }): void {
    this.office = data?.office ?? null;
    this.desks = data?.desks ?? [];
  }

  preload(): void {
    if (!this.office) return;
    const o = this.office;
    this.load.tilemapTiledJSON("admin-office", `${BASE_URL}/maps/${o.id}/${o.tmj_filename}`);
    for (const t of o.tilesets) {
      this.load.image(`admin-tiles:${o.id}:${t.ordinal}`, `${BASE_URL}/maps/${o.id}/${t.filename}`);
    }
  }

  create(): void {
    if (!this.office) return;
    const o = this.office;

    const map = this.make.tilemap({ key: "admin-office" });
    const tilesetObjs: Phaser.Tilemaps.Tileset[] = [];
    for (const t of o.tilesets) {
      const name = t.image_name.replace(/\.[^.]+$/, "");
      const ts = map.addTilesetImage(name, `admin-tiles:${o.id}:${t.ordinal}`);
      if (ts) tilesetObjs.push(ts);
    }
    for (const layer of map.layers) map.createLayer(layer.name, tilesetObjs);

    for (const d of this.desks) this.renderDesk(d);

    this.hudText = this.add
      .text(
        8,
        8,
        "ADMIN — N: nuevo · F2: renombrar · DEL: borrar · F: fijo · Shift+F: quitar fijo",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "10px",
          color: "#36e36c",
        },
      )
      .setScrollFactor(0);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });

    this.input.keyboard?.on("keydown-N", () => this.startPlacing());
    this.input.keyboard?.on("keydown-ESC", () => this.cancelPlacing());
    this.input.keyboard?.on("keydown-F2", () => void this.renameSelected());
    this.input.keyboard?.on("keydown-DELETE", () => void this.deleteSelected());
    this.input.keyboard?.on("keydown-BACKSPACE", () => void this.deleteSelected());
    this.input.keyboard?.on("keydown-F", (event: KeyboardEvent) => {
      if (event.shiftKey) void this.unassignFixed();
      else void this.assignFixed();
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.placingPreview) {
        const { x, y } = this.snap(pointer.worldX, pointer.worldY, pointer.event.shiftKey);
        this.placingPreview.setPosition(x, y);
      }
    });
  }

  private renderDesk(desk: DeskData): void {
    const rect = drawDesk(this, desk, "idle");
    rect.setInteractive();
    rect.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, event: Event) => {
      this.selectDesk(desk.id);
      (event as { stopPropagation?: () => void }).stopPropagation?.();
    });
    this.deskRects.set(desk.id, rect);
  }

  private startPlacing(): void {
    if (this.placing) return;
    this.placing = true;
    this.placingPreview = drawDesk(this, { x: -100, y: -100 }, "placing");
    this.hudText?.setText("Click para colocar · ESC para cancelar (Shift = snap)");
  }

  private cancelPlacing(): void {
    this.placing = false;
    this.placingPreview?.destroy();
    this.placingPreview = null;
    this.hudText?.setText("ADMIN — N: nuevo · F2: renombrar · DEL: borrar");
  }

  private snap(x: number, y: number, shift: boolean): { x: number; y: number } {
    if (!shift || !this.office) return { x: Math.round(x), y: Math.round(y) };
    const tw = this.office.tile_width;
    const th = this.office.tile_height;
    return {
      x: Math.round(x / tw) * tw,
      y: Math.round(y / th) * th,
    };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.office) return;
    if (!this.placing) {
      this.selectedId = null;
      this.refreshSelectionStyles();
      return;
    }
    const { x, y } = this.snap(pointer.worldX, pointer.worldY, pointer.event.shiftKey);
    const validation = validateDeskPlacement(
      x,
      y,
      { width: this.office.map_width, height: this.office.map_height },
      this.desks.map((d) => ({ x: d.x, y: d.y })),
    );
    if (!validation.ok) {
      this.hudText?.setText(`Error: ${validation.reason}`);
      return;
    }
    const label = window.prompt("Label del puesto") ?? "";
    if (!label) return;
    void this.createDesk(label, x, y);
  }

  private async createDesk(label: string, x: number, y: number): Promise<void> {
    if (!this.office) return;
    try {
      const res = await fetch(`${BASE_URL}/api/offices/${this.office.id}/desks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label, x, y }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { reason?: string };
        this.hudText?.setText(`Error: ${err.reason ?? res.status}`);
        return;
      }
      const body = (await res.json()) as { desk: DeskData };
      this.desks.push(body.desk);
      this.renderDesk(body.desk);
      this.cancelPlacing();
    } catch {
      this.hudText?.setText("Error de red");
    }
  }

  private selectDesk(id: number): void {
    this.selectedId = id;
    this.refreshSelectionStyles();
  }

  private refreshSelectionStyles(): void {
    for (const [id, rect] of this.deskRects) {
      if (id === this.selectedId) {
        rect.setStrokeStyle(3, 0x5cf6ff, 1);
      } else {
        rect.setStrokeStyle(2, 0xf5f5f5, 1);
      }
    }
  }

  private async renameSelected(): Promise<void> {
    if (this.selectedId === null) return;
    const newLabel = window.prompt("Nuevo label") ?? "";
    if (!newLabel) return;
    const res = await fetch(`${BASE_URL}/api/desks/${this.selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ label: newLabel }),
    });
    if (res.ok) {
      const desk = this.desks.find((d) => d.id === this.selectedId);
      if (desk) desk.label = newLabel;
    } else {
      const err = (await res.json()) as { reason?: string };
      this.hudText?.setText(`Error: ${err.reason ?? res.status}`);
    }
  }

  private async deleteSelected(): Promise<void> {
    if (this.selectedId === null) return;
    if (!window.confirm("¿Borrar este puesto?")) return;
    const id = this.selectedId;
    const res = await fetch(`${BASE_URL}/api/desks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.status === 204) {
      this.deskRects.get(id)?.destroy();
      this.deskRects.delete(id);
      this.desks = this.desks.filter((d) => d.id !== id);
      this.selectedId = null;
    }
  }

  private async assignFixed(): Promise<void> {
    if (this.selectedId === null) {
      this.hudText?.setText("Selecciona un puesto primero");
      return;
    }
    const userIdRaw = window.prompt("ID del usuario al que asignar como fijo");
    if (!userIdRaw) return;
    const userId = Number(userIdRaw);
    if (!Number.isInteger(userId) || userId <= 0) {
      this.hudText?.setText("ID inválido");
      return;
    }
    const res = await fetch(`${BASE_URL}/api/desks/${this.selectedId}/fixed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    if (res.status === 201) {
      this.hudText?.setText(`Asignado fijo en desk #${this.selectedId}`);
    } else {
      const err = (await res.json().catch(() => ({}))) as { reason?: string };
      this.hudText?.setText(`Error: ${err.reason ?? res.status}`);
    }
  }

  private async unassignFixed(): Promise<void> {
    if (this.selectedId === null) return;
    if (!window.confirm("¿Quitar puesto fijo?")) return;
    const res = await fetch(`${BASE_URL}/api/desks/${this.selectedId}/fixed`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.status === 204) {
      this.hudText?.setText(`Fijo retirado en desk #${this.selectedId}`);
    } else {
      const err = (await res.json().catch(() => ({}))) as { reason?: string };
      this.hudText?.setText(`Error: ${err.reason ?? res.status}`);
    }
  }
}
