import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";
import { drawDesk } from "../render/desk-renderer.js";
import { deskState } from "../domain/desk-state.js";
import type { Desk, OfficeDetail } from "../state/office.js";

export class OfficeScene extends Phaser.Scene {
  private detail: OfficeDetail | null = null;
  private meId: number = 0;
  private deskRects: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private feedbackText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "OfficeScene" });
  }

  init(data: { detail?: OfficeDetail; meId?: number }): void {
    this.detail = data?.detail ?? null;
    this.meId = data?.meId ?? 0;
  }

  preload(): void {
    if (!this.detail) return;
    const o = this.detail.office;
    this.load.tilemapTiledJSON("office", `${BASE_URL}/maps/${o.id}/${o.tmj_filename}`);
    for (const t of this.detail.tilesets) {
      this.load.image(`tiles:${o.id}:${t.ordinal}`, `${BASE_URL}/maps/${o.id}/${t.filename}`);
    }
  }

  create(): void {
    const { width, height } = this.scale;

    if (!this.detail) {
      this.add
        .text(width / 2, height / 2, "OFFICE\n(sin mapa cargado)", {
          fontFamily: '"Press Start 2P"',
          fontSize: "14px",
          color: "#00ff9f",
          align: "center",
          lineSpacing: 10,
        })
        .setOrigin(0.5);
      return;
    }

    const o = this.detail.office;
    const map = this.make.tilemap({ key: "office" });
    const tilesetObjs: Phaser.Tilemaps.Tileset[] = [];
    for (const t of this.detail.tilesets) {
      const name = t.image_name.replace(/\.[^.]+$/, "");
      const ts = map.addTilesetImage(name, `tiles:${o.id}:${t.ordinal}`);
      if (ts) tilesetObjs.push(ts);
    }
    for (const layer of map.layers) map.createLayer(layer.name, tilesetObjs);

    this.renderDesks();

    this.feedbackText = this.add
      .text(8, height - 24, "", {
        fontFamily: '"VT323"',
        fontSize: "16px",
        color: "#ffff00",
      })
      .setScrollFactor(0);
  }

  private renderDesks(): void {
    if (!this.detail) return;
    for (const desk of this.detail.desks) {
      const state = deskState(desk, this.detail.bookings, this.meId);
      const rect = drawDesk(this, desk, state);
      rect.setInteractive();
      rect.on("pointerdown", () => void this.handleDeskClick(desk));
      this.deskRects.set(desk.id, rect);
    }
  }

  private async handleDeskClick(desk: Desk): Promise<void> {
    if (!this.detail) return;
    const state = deskState(desk, this.detail.bookings, this.meId);

    if (state === "fixed") {
      const b = this.detail.bookings.find((x) => x.deskId === desk.id);
      this.showFeedback(`📌 Puesto fijo de ${b?.user.name ?? "otro usuario"}`);
      return;
    }
    if (state === "occupied") {
      const b = this.detail.bookings.find((x) => x.deskId === desk.id);
      this.showFeedback(`Ocupado por ${b?.user.name ?? "otro usuario"}`);
      return;
    }

    if (state === "mine") {
      if (!window.confirm(`¿Liberar ${desk.label}?`)) return;
      await this.releaseDesk(desk);
      return;
    }

    // free
    const dateLabel = formatDateEs(this.detail.date);
    const myBooking = this.detail.bookings.find((b) => b.userId === this.meId);
    if (myBooking) {
      const movingFromDesk = this.detail.desks.find((d) => d.id === myBooking.deskId);
      if (
        !window.confirm(
          `Ya tienes ${movingFromDesk?.label ?? "una reserva"} reservado el ${dateLabel}. ¿Liberarlo y reservar ${desk.label}?`,
        )
      ) {
        return;
      }
      await this.releaseDesk(movingFromDesk ?? null);
    } else {
      if (!window.confirm(`¿Reservar ${desk.label} el ${dateLabel}?`)) return;
    }
    await this.reserveDesk(desk);
  }

  private async reserveDesk(desk: Desk): Promise<void> {
    if (!this.detail) return;
    const date = this.detail.date;
    const res = await fetch(`${BASE_URL}/api/desks/${desk.id}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ date }),
    });
    if (res.ok) {
      await this.refreshSnapshot();
      return;
    }
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    if (res.status === 409) {
      this.showFeedback(`Ya estaba ocupado: ${err.reason ?? "conflicto"}`);
      await this.refreshSnapshot();
    } else {
      this.showFeedback(`Error: ${err.reason ?? res.status}`);
    }
  }

  private async releaseDesk(desk: Desk | null): Promise<void> {
    if (!this.detail || !desk) return;
    const date = this.detail.date;
    const res = await fetch(`${BASE_URL}/api/desks/${desk.id}/bookings`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ date }),
    });
    if (res.status === 204) {
      await this.refreshSnapshot();
      return;
    }
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    this.showFeedback(`Error: ${err.reason ?? res.status}`);
  }

  private async refreshSnapshot(): Promise<void> {
    if (!this.detail) return;
    const o = this.detail.office;
    const res = await fetch(`${BASE_URL}/api/offices/${o.id}?date=${this.detail.date}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const fresh = (await res.json()) as OfficeDetail;
    this.detail = fresh;

    for (const rect of this.deskRects.values()) rect.destroy();
    this.deskRects.clear();
    this.renderDesks();
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
    this.time.delayedCall(2500, () => this.feedbackText?.setText(""));
  }
}

function formatDateEs(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function computeMapScale(
  canvasWidth: number,
  canvasHeight: number,
  mapWidth: number,
  mapHeight: number,
): number {
  if (mapWidth <= 0 || mapHeight <= 0) return 1;
  return Math.min(canvasWidth / mapWidth, canvasHeight / mapHeight);
}

export type { BookingDto } from "../state/office.js";
