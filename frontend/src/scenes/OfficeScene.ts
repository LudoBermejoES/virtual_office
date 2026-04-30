import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";
import { drawDesk } from "../render/desk-renderer.js";
import { drawZone, drawLabel, findZoneAt } from "../render/zone-renderer.js";
import { placeAvatar, placeFallback } from "../render/avatar-mask.js";
import type { AvatarVisual } from "../render/avatar-mask.js";
import { deskState } from "../domain/desk-state.js";
import { connectOffice } from "../realtime/socket.js";
import { uiStore, shouldApply } from "../state/ui.js";
import type { ConnectHandle } from "../realtime/socket.js";
import type { WsServerMessage } from "@virtual-office/shared";
import type { Desk, OfficeDetail } from "../state/office.js";

export class OfficeScene extends Phaser.Scene {
  private detail: OfficeDetail | null = null;
  private meId: number = 0;
  private deskRects: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private deskAvatars: Map<number, AvatarVisual> = new Map();
  private avatarStatus: Map<number, "loading" | "ready"> = new Map();
  private tooltipEl: HTMLDivElement | null = null;
  private feedbackText: Phaser.GameObjects.Text | null = null;
  private zoneText: Phaser.GameObjects.Text | null = null;
  private zoneGraphics: Phaser.GameObjects.Graphics | null = null;
  private wsHandle: ConnectHandle | null = null;
  private bufferedMessages: WsServerMessage[] = [];
  private snapshotReady = true;

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
          color: "#36e36c",
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

    this.zoneGraphics = this.add.graphics();
    this.renderZones();
    this.renderDesks();

    this.feedbackText = this.add
      .text(8, height - 24, "", {
        fontFamily: '"VT323"',
        fontSize: "16px",
        color: "#ffd166",
      })
      .setScrollFactor(0);

    this.zoneText = this.add
      .text(8, height - 44, "", {
        fontFamily: "VT323",
        fontSize: "16px",
        color: "#8e92a8",
      })
      .setScrollFactor(0);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.detail?.features) return;
      const zone = findZoneAt(pointer.worldX, pointer.worldY, this.detail.features.zones);
      this.zoneText?.setText(zone ? zone.name : "");
    });

    this.connectRealtime();

    const unsubscribeDate = uiStore.subscribe((state, prev) => {
      if (state.selectedDate !== prev.selectedDate && this.detail) {
        this.detail.date = state.selectedDate;
        void this.refreshSnapshot();
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeDate();
      this.wsHandle?.close();
      this.wsHandle = null;
    });
  }

  private renderZones(): void {
    if (!this.detail?.features || !this.zoneGraphics) return;
    this.zoneGraphics.clear();
    for (const zone of this.detail.features.zones) {
      drawZone(this.zoneGraphics, zone);
    }
    for (const room of this.detail.features.rooms) {
      drawZone(this.zoneGraphics, room);
    }
    for (const label of this.detail.features.labels) {
      drawLabel(this, label);
    }
  }

  private connectRealtime(): void {
    if (!this.detail) return;
    this.snapshotReady = true;
    this.wsHandle = connectOffice({
      officeId: this.detail.office.id,
      onMessage: (msg) => {
        if (!this.snapshotReady) {
          this.bufferedMessages.push(msg);
          return;
        }
        this.applyDelta(msg);
      },
      onClose: (code) => {
        if (code === 4001) {
          this.showFeedback("Sesión expirada");
        }
      },
    });
  }

  private applyDelta(msg: WsServerMessage): void {
    if (!this.detail) return;
    if (!shouldApply(msg, this.detail.date)) return;
    if (msg.type === "snapshot.ts") return;
    if (msg.type === "auth.expired") return;
    if (msg.type === "office.updated") {
      void this.refreshSnapshot();
      return;
    }

    if (msg.type === "desk.booked" && msg.date === this.detail.date) {
      this.detail.bookings = this.detail.bookings.filter((b) => b.deskId !== msg.deskId);
      this.detail.bookings.push({
        id: -Date.now(),
        deskId: msg.deskId,
        userId: msg.user.id,
        type: "daily",
        date: msg.date,
        user: msg.user,
      });
    } else if (msg.type === "desk.released" && msg.date === this.detail.date) {
      this.detail.bookings = this.detail.bookings.filter((b) => b.deskId !== msg.deskId);
    } else if (msg.type === "desk.fixed") {
      this.detail.bookings = this.detail.bookings.filter((b) => b.deskId !== msg.deskId);
      this.detail.bookings.push({
        id: -Date.now(),
        deskId: msg.deskId,
        userId: msg.user.id,
        type: "fixed",
        date: this.detail.date,
        user: msg.user,
      });
    } else if (msg.type === "desk.unfixed") {
      this.detail.bookings = this.detail.bookings.filter((b) => b.deskId !== msg.deskId);
    } else {
      return;
    }
    this.rerenderDesks();
  }

  private rerenderDesks(): void {
    for (const rect of this.deskRects.values()) rect.destroy();
    this.deskRects.clear();
    for (const visual of this.deskAvatars.values()) visual.destroy();
    this.deskAvatars.clear();
    this.renderDesks();
  }

  private renderDesks(): void {
    if (!this.detail) return;
    if (!this.tooltipEl) this.mountTooltip();
    for (const desk of this.detail.desks) {
      const state = deskState(desk, this.detail.bookings, this.meId);
      const rect = drawDesk(this, desk, state);
      rect.setInteractive();
      rect.on("pointerdown", () => void this.handleDeskClick(desk));
      this.deskRects.set(desk.id, rect);

      const booking = this.detail.bookings.find((b) => b.deskId === desk.id);
      if (booking) {
        this.renderAvatarFor(desk, booking.user);
        rect.on("pointerover", (pointer: Phaser.Input.Pointer) => {
          this.showTooltip(booking.user.name, pointer.x, pointer.y);
        });
        rect.on("pointerout", () => this.hideTooltip());
      }
    }
  }

  private renderAvatarFor(
    desk: Desk,
    user: { id: number; name: string; avatar_url: string | null },
  ): void {
    if (!user.avatar_url) {
      const visual = placeFallback(this, desk.x, desk.y, user);
      this.deskAvatars.set(desk.id, visual);
      return;
    }
    const key = `avatar:${user.id}`;
    if (this.textures.exists(key)) {
      const visual = placeAvatar(this, key, desk.x, desk.y);
      this.deskAvatars.set(desk.id, visual);
      return;
    }
    if (this.avatarStatus.get(user.id) === "loading") {
      const fb = placeFallback(this, desk.x, desk.y, user);
      this.deskAvatars.set(desk.id, fb);
      return;
    }
    const fallback = placeFallback(this, desk.x, desk.y, user);
    this.deskAvatars.set(desk.id, fallback);
    this.avatarStatus.set(user.id, "loading");
    this.load.image(key, user.avatar_url);
    this.load.once(`filecomplete-image-${key}`, () => {
      this.avatarStatus.set(user.id, "ready");
      const cur = this.deskAvatars.get(desk.id);
      if (cur) cur.destroy();
      const visual = placeAvatar(this, key, desk.x, desk.y);
      this.deskAvatars.set(desk.id, visual);
    });
    this.load.once("loaderror", () => {
      this.avatarStatus.delete(user.id);
    });
    this.load.start();
  }

  private mountTooltip(): void {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "tooltip";
    Object.assign(el.style, {
      position: "fixed",
      pointerEvents: "none",
      padding: "4px 8px",
      backgroundColor: "rgba(11, 13, 26, 0.9)",
      color: "var(--color-fg)",
      borderRadius: "4px",
      display: "none",
      zIndex: "1000",
    });
    document.body.appendChild(el);
    this.tooltipEl = el;

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.hideTooltip();
    });
  }

  private showTooltip(text: string, x: number, y: number): void {
    if (!this.tooltipEl) return;
    this.tooltipEl.textContent = text;
    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.left = `${x + 8}px`;
    this.tooltipEl.style.top = `${y - 30}px`;
  }

  private hideTooltip(): void {
    if (!this.tooltipEl) return;
    this.tooltipEl.style.display = "none";
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

    this.rerenderDesks();
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
