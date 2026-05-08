import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";
import { drawDesk } from "../render/desk-renderer.js";
import { drawZone, drawLabel, findZoneAt } from "../render/zone-renderer.js";
import { placeAvatar, placeFallback } from "../render/avatar-mask.js";
import type { AvatarVisual } from "../render/avatar-mask.js";
import { placeSeatSprite, SEAT_ANIM_KEY, SEAT_SPRITE_KEY } from "../render/seat-sprite.js";
import { renderNpcs } from "../render/npc-renderer.js";
import { preloadTiledSprites, renderTiledSprites } from "../render/tiled-sprites.js";
import { SPRITE_MANIFEST } from "../render/sprite-manifest.js";
import { SpritePool } from "../render/sprite-pool.js";
import { deskState } from "../domain/desk-state.js";
import { connectOffice } from "../realtime/socket.js";
import { uiStore, shouldApply } from "../state/ui.js";
import { officesStore } from "../state/offices.js";
import { mountAdminBookModal, unmountAdminBookModal } from "../ui/admin-book-modal.js";
import type { AdminBookModalUser } from "../ui/admin-book-modal.js";
import { mountWeeklyActionModal, unmountWeeklyActionModal } from "../ui/weekly-action-modal.js";
import { DOW_LABELS_LONG_ES } from "@virtual-office/shared";
import type { ConnectHandle } from "../realtime/socket.js";
import type { WsServerMessage } from "@virtual-office/shared";
import type { Desk, OfficeDetail } from "../state/office.js";

export class OfficeScene extends Phaser.Scene {
  private detail: OfficeDetail | null = null;
  private meId: number = 0;
  private pickDeskMode: ((deskId: number, label: string) => void) | null = null;
  private pickBannerEl: HTMLDivElement | null = null;

  activatePickDeskMode(onPicked: (deskId: number, label: string) => void): void {
    this.pickDeskMode = onPicked;
    const banner = document.createElement("div");
    this.pickBannerEl = banner;
    Object.assign(banner.style, {
      position: "fixed",
      top: "52px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#5cf6ff",
      color: "#0b0d1a",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "10px",
      padding: "8px 16px",
      zIndex: "200",
      pointerEvents: "none",
    });
    banner.textContent = "SELECCIONA UN PUESTO EN EL MAPA";
    document.body.appendChild(banner);
  }

  private deactivatePickDeskMode(): void {
    this.pickBannerEl?.remove();
    this.pickBannerEl = null;
    this.pickDeskMode = null;
  }
  private deskRects: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private deskAvatars: Map<number, AvatarVisual> = new Map();
  private deskSeatSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private avatarStatus: Map<number, "loading" | "ready"> = new Map();
  private npcSprites: Phaser.GameObjects.Sprite[] = [];
  private tiledSprites: Phaser.GameObjects.Sprite[] = [];
  private spritePool: SpritePool = new SpritePool();
  private poolTimer: Phaser.Time.TimerEvent | null = null;
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
    // Cuando el TMJ esté parseado, recolectamos los sprites referenciados en
    // object layers `sprites_*` y los añadimos al loader. Phaser permite
    // añadir tasks durante el preload.
    this.load.once("filecomplete-tilemapJSON-office", () => {
      const tmj = (this.cache.tilemap.get("office") as { data?: unknown } | undefined)?.data;
      if (tmj) preloadTiledSprites(this, tmj as never, SPRITE_MANIFEST);
    });
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

    // Sprites Aseprite anclados a object layers `sprites_*` del TMJ.
    // Los aseprites se encolan en el callback `filecomplete-tilemapJSON-office`
    // del preload, pero su descarga puede no haber terminado todavía cuando
    // llegamos aquí. Renderizamos lo que esté disponible y, si el loader sigue
    // activo, repetimos al COMPLETE para recoger los que llegaron tarde.
    const tmjData = (this.cache.tilemap.get("office") as { data?: unknown } | undefined)?.data;
    if (tmjData) {
      const renderSprites = (): void => {
        for (const s of this.tiledSprites) s.destroy();
        this.tiledSprites = renderTiledSprites(this, tmjData as never, SPRITE_MANIFEST);
      };
      renderSprites();
      if (this.load.isLoading()) {
        this.load.once(Phaser.Loader.Events.COMPLETE, () => renderSprites());
      }
    }

    this.fitCameraToMap(map);

    this.zoneGraphics = this.add.graphics();
    this.renderZones();
    this.defineSpriteAnimations();
    this.renderDesks();
    this.renderNpcs();

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

    this.poolTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.updateSpritePool(),
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
      for (const s of this.tiledSprites) s.destroy();
      this.tiledSprites = [];
    });
  }

  private fitCameraToMap(map: Phaser.Tilemaps.Tilemap): void {
    const HUD_HEIGHT = 48;
    const { width, height } = this.scale;
    const availH = height - HUD_HEIGHT;
    const mapW = map.widthInPixels;
    const mapH = map.heightInPixels;
    const zoom = Math.min(width / mapW, availH / mapH);
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    // Center the viewport in the available area below the HUD
    cam.setViewport(0, HUD_HEIGHT, width, availH);
    cam.centerOn(mapW / 2, mapH / 2);
  }

  private defineSpriteAnimations(): void {
    if (this.textures.exists(SEAT_SPRITE_KEY) && !this.anims.exists(SEAT_ANIM_KEY)) {
      this.anims.create({
        key: SEAT_ANIM_KEY,
        frames: this.anims.generateFrameNumbers(SEAT_SPRITE_KEY, { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1,
      });
    }
    const npcDefs: Array<{ key: string; animKey: string; frames: number }> = [
      { key: "npc-cat-idle", animKey: "npc-cat-idle", frames: 1 },
      { key: "npc-bird-idle", animKey: "npc-bird-idle", frames: 1 },
      { key: "npc-roomba-idle", animKey: "npc-roomba-idle", frames: 1 },
      { key: "npc-plant-sway", animKey: "npc-plant-sway", frames: 1 },
    ];
    for (const def of npcDefs) {
      if (this.textures.exists(def.key) && !this.anims.exists(def.animKey)) {
        this.anims.create({
          key: def.animKey,
          frames: this.anims.generateFrameNumbers(def.key, { start: 0, end: def.frames - 1 }),
          frameRate: 4,
          repeat: -1,
        });
      }
    }
  }

  private renderNpcs(): void {
    for (const s of this.npcSprites) s.destroy();
    this.npcSprites = [];
    if (!this.detail?.npcs) return;
    this.npcSprites = renderNpcs(this, this.detail.npcs);
    this.updateSpritePool();
  }

  private updateSpritePool(): void {
    const allSprites = [...this.deskSeatSprites.values(), ...this.npcSprites];
    if (allSprites.length === 0) return;
    this.spritePool.update(allSprites, this.cameras.main);
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
    if (msg.type === "desk.fixed_skipped" || msg.type === "desk.fixed_unskipped") {
      if (msg.date === this.detail.date) {
        void this.refreshSnapshot();
      }
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
    for (const s of this.deskSeatSprites.values()) s.destroy();
    this.deskSeatSprites.clear();
    this.renderDesks();
  }

  private renderDesks(): void {
    if (!this.detail) return;
    if (!this.tooltipEl) this.mountTooltip();
    for (const desk of this.detail.desks) {
      const state = deskState(desk, this.detail.bookings, this.meId);
      const rect = drawDesk(this, desk, state);
      if (state !== "free") rect.setAlpha(0);
      rect.setInteractive();
      rect.on("pointerdown", () => void this.handleDeskClick(desk));
      this.deskRects.set(desk.id, rect);

      const booking = this.detail.bookings.find((b) => b.deskId === desk.id);
      if (booking) {
        const seatSprite = placeSeatSprite(this, desk.x, desk.y, booking.user.id);
        if (seatSprite) {
          this.deskSeatSprites.set(desk.id, seatSprite);
          this.renderAvatarFor(desk, booking.user, -28);
        } else {
          this.renderAvatarFor(desk, booking.user, 0);
        }
        rect.on("pointerover", (pointer: Phaser.Input.Pointer) => {
          this.showTooltip(booking.user.name, pointer.x, pointer.y);
        });
        rect.on("pointerout", () => this.hideTooltip());
      }
    }
    this.updateSpritePool();
  }

  private renderAvatarFor(
    desk: Desk,
    user: { id: number; name: string; avatar_url: string | null },
    yOffset: number = 0,
  ): void {
    const ay = desk.y + yOffset;
    const onClick = (): void => void this.handleDeskClick(desk);
    if (!user.avatar_url) {
      const visual = placeFallback(this, desk.x, ay, user, onClick);
      this.deskAvatars.set(desk.id, visual);
      return;
    }
    const key = `avatar:${user.id}`;
    if (this.textures.exists(key)) {
      const visual = placeAvatar(this, key, desk.x, ay, onClick);
      this.deskAvatars.set(desk.id, visual);
      return;
    }
    if (this.avatarStatus.get(user.id) === "loading") {
      const fb = placeFallback(this, desk.x, ay, user, onClick);
      this.deskAvatars.set(desk.id, fb);
      return;
    }
    const fallback = placeFallback(this, desk.x, ay, user, onClick);
    this.deskAvatars.set(desk.id, fallback);
    this.avatarStatus.set(user.id, "loading");
    this.load.image(key, user.avatar_url);
    this.load.once(`filecomplete-image-${key}`, () => {
      this.avatarStatus.set(user.id, "ready");
      const cur = this.deskAvatars.get(desk.id);
      if (cur) cur.destroy();
      const visual = placeAvatar(this, key, desk.x, ay, onClick);
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

    if (this.pickDeskMode) {
      const cb = this.pickDeskMode;
      this.deactivatePickDeskMode();
      cb(desk.id, desk.label);
      return;
    }

    const state = deskState(desk, this.detail.bookings, this.meId);

    if (state === "fixed") {
      const b = this.detail.bookings.find((x) => x.deskId === desk.id);
      const isMyFixed = b?.userId === this.meId;
      const isAdmin = officesStore.getState().meRole === "admin";
      if (isMyFixed) {
        if (
          window.confirm(`¿Hoy no vienes? Tu puesto fijo (${desk.label}) quedará libre para otros.`)
        ) {
          await this.skipFixedDay(desk);
        }
        return;
      }
      if (isAdmin) {
        if (
          window.confirm(
            `¿Marcar que ${b?.user.name ?? "este usuario"} hoy no viene? Su puesto fijo (${desk.label}) quedará libre.`,
          )
        ) {
          await this.skipFixedDay(desk);
        }
        return;
      }
      this.showFeedback(`📌 Puesto fijo de ${b?.user.name ?? "otro usuario"}`);
      return;
    }

    // Si este desk es mi fijo con excepción activa hoy, ofrecer deshacer
    if (this.detail.myFixedExceptionDeskId === desk.id) {
      if (window.confirm(`¿Vuelves hoy a tu puesto fijo (${desk.label})?`)) {
        await this.unskipFixedDay(desk);
      }
      return;
    }
    const isAdmin = officesStore.getState().meRole === "admin";

    // Branch weekly (change 028): si la reserva proyectada es weekly,
    // gestionarla con el modal dedicado en lugar del flujo normal de
    // bookings. Sin esto, admin clicks daban 404 (intentaba DELETE
    // /bookings que no existe para weeklies proyectadas).
    const bookingHere = this.detail.bookings.find((x) => x.deskId === desk.id);
    if (bookingHere?.type === "weekly") {
      const isMine = bookingHere.userId === this.meId;
      if (!isAdmin && !isMine) {
        this.showFeedback(`Ocupado por ${bookingHere.user.name}`);
        return;
      }
      await this.openWeeklyActionModal(desk, bookingHere);
      return;
    }

    // Admin: en lugar de la acción directa, abrir el modal del change 026 que
    // permite reservar/liberar a nombre de cualquier usuario.
    if (isAdmin) {
      await this.openAdminBookModal(desk, state);
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

  /**
   * Modal admin del change 026 — permite al admin reservar el desk a nombre de
   * cualquier usuario, o liberar la reserva de quien sea. El modal no toca
   * desks con `state === "fixed"` (esos siguen el flujo skip/unskip ya
   * existente en `handleDeskClick`).
   */
  private async openAdminBookModal(
    desk: Desk,
    state: "free" | "mine" | "occupied" | "fixed",
  ): Promise<void> {
    if (!this.detail) return;
    if (state === "fixed") return; // gestionado fuera

    const dateIso = this.detail.date;
    const dateLabel = formatDateEs(dateIso);

    if (state === "occupied" || state === "mine") {
      const booking = this.detail.bookings.find((b) => b.deskId === desk.id);
      if (!booking) return;
      mountAdminBookModal({
        deskLabel: desk.label,
        dateLabel,
        mode: {
          kind: "release",
          bookedBy: {
            id: booking.user.id,
            email: "",
            name: booking.user.name,
            avatar_url: booking.user.avatar_url,
          },
        },
        onConfirmRelease: async () => {
          await this.releaseDeskFor(desk, booking.user.id);
          unmountAdminBookModal();
        },
      });
      return;
    }

    // free → cargar lista de usuarios y weeklies de la oficina
    let users: AdminBookModalUser[] = [];
    let officeWeeklies: Array<{
      id: number;
      desk: { id: number; label: string };
      user: { id: number; name: string; email: string; avatar_url: string | null };
      dow: number;
    }> = [];
    try {
      const [usersRes, weeklyRes] = await Promise.all([
        fetch(`${BASE_URL}/api/users`, { credentials: "include" }),
        fetch(`${BASE_URL}/api/offices/${this.detail.office.id}/weekly`, {
          credentials: "include",
        }),
      ]);
      if (!usersRes.ok) {
        this.showFeedback(`Error cargando usuarios: ${usersRes.status}`);
        return;
      }
      users = (await usersRes.json()) as AdminBookModalUser[];
      // weeklyRes puede fallar 403 si caller no es admin — improbable aquí
      // pero no bloqueante. Tratamos como lista vacía.
      if (weeklyRes.ok) {
        officeWeeklies = (await weeklyRes.json()) as typeof officeWeeklies;
      }
    } catch {
      this.showFeedback("Error de red cargando usuarios");
      return;
    }

    // Construye mapas para el modal:
    //  - weeklyByUser: lo que ya hay en ESTE desk (preselección checkboxes).
    //  - conflictingDowsByUser: dows ocupados en OTROS desks (disabled).
    const weeklyByUser: Record<string, Array<{ dow: number; weeklyId: number }>> = {};
    const conflictingDowsByUser: Record<string, number[]> = {};
    for (const w of officeWeeklies) {
      const key = String(w.user.id);
      if (w.desk.id === desk.id) {
        if (!weeklyByUser[key]) weeklyByUser[key] = [];
        weeklyByUser[key].push({ dow: w.dow, weeklyId: w.id });
      } else {
        if (!conflictingDowsByUser[key]) conflictingDowsByUser[key] = [];
        conflictingDowsByUser[key].push(w.dow);
      }
    }

    mountAdminBookModal({
      deskLabel: desk.label,
      dateLabel,
      mode: {
        kind: "book",
        users,
        meId: this.meId,
        weeklyByUser,
        conflictingDowsByUser,
      },
      onConfirmBook: async (userId, weeklyChanges) => {
        // 1) Aplicar cambios de weeklies en serie. Si alguna falla, paramos
        //    y reportamos en el HUD; los cambios anteriores se mantienen.
        for (const id of weeklyChanges.deleteIds) {
          const ok = await this.deleteWeekly(desk.id, id);
          if (!ok) return;
        }
        for (const c of weeklyChanges.create) {
          const ok = await this.createWeekly(desk.id, c.userId, c.dow);
          if (!ok) return;
        }
        // 2) Si el admin además seleccionó un user para reserva diaria,
        //    crearla. Si solo gestionaba weeklies sin reservar el día, userId
        //    puede venir null.
        if (userId !== null) {
          await this.reserveDeskFor(desk, userId);
        } else {
          await this.refreshSnapshot();
        }
        unmountAdminBookModal();
      },
    });
  }

  /**
   * Modal del change 028: el caller pulsó un puesto cuya reserva visible es
   * de tipo weekly. Distingue tres modos:
   *  - user dueño de la weekly y SIN excepción para hoy → "Saltarme hoy"
   *  - user dueño con excepción ya activa → "Recuperar mi puesto"
   *  - admin sobre weekly de cualquiera → "Saltar este día" + "Quitar todos los X"
   */
  private async openWeeklyActionModal(
    desk: Desk,
    booking: { userId: number; user: { name: string }; weeklyId?: number; dow?: number },
  ): Promise<void> {
    if (!this.detail) return;
    const weeklyId = booking.weeklyId;
    const dow = booking.dow;
    if (weeklyId === undefined || dow === undefined) {
      this.showFeedback("Datos de weekly incompletos");
      return;
    }
    const dateIso = this.detail.date;
    const dateLabel = formatDateEs(dateIso);
    const dowLabel = DOW_LABELS_LONG_ES[dow]?.toLowerCase() ?? "este día";

    const isAdmin = officesStore.getState().meRole === "admin";
    const isMine = booking.userId === this.meId;

    if (isMine && !isAdmin) {
      mountWeeklyActionModal({
        deskLabel: desk.label,
        dateLabel,
        dowLabel,
        mode: { kind: "user_self" },
        onSkipDay: async () => {
          await this.skipWeeklyDay(desk, weeklyId, dateIso);
          unmountWeeklyActionModal();
        },
        onClose: () => unmountWeeklyActionModal(),
      });
      return;
    }

    if (isAdmin) {
      mountWeeklyActionModal({
        deskLabel: desk.label,
        dateLabel,
        dowLabel,
        mode: { kind: "admin", targetUserName: booking.user.name },
        onSkipDay: async () => {
          await this.skipWeeklyDay(desk, weeklyId, dateIso);
          unmountWeeklyActionModal();
        },
        onDeleteWeekly: async () => {
          await this.deleteWeekly(desk.id, weeklyId);
          await this.refreshSnapshot();
          unmountWeeklyActionModal();
        },
        onClose: () => unmountWeeklyActionModal(),
      });
    }
  }

  private async skipWeeklyDay(desk: Desk, weeklyId: number, date: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/desks/${desk.id}/weekly/${weeklyId}/exceptions`, {
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
    this.showFeedback(`Error: ${err.reason ?? String(res.status)}`);
  }

  private async createWeekly(deskId: number, userId: number, dow: number): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/api/desks/${deskId}/weekly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, dow }),
    });
    if (res.ok) return true;
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    this.showFeedback(`Error weekly: ${err.reason ?? String(res.status)}`);
    return false;
  }

  private async deleteWeekly(deskId: number, weeklyId: number): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/api/desks/${deskId}/weekly/${weeklyId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.status === 204 || res.ok) return true;
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    this.showFeedback(`Error weekly delete: ${err.reason ?? String(res.status)}`);
    return false;
  }

  private async reserveDeskFor(desk: Desk, userId: number): Promise<void> {
    if (!this.detail) return;
    const date = this.detail.date;
    const res = await fetch(`${BASE_URL}/api/desks/${desk.id}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ date, userId }),
    });
    if (res.ok) {
      await this.refreshSnapshot();
      return;
    }
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    this.showFeedback(`Error: ${err.reason ?? res.status}`);
  }

  private async releaseDeskFor(desk: Desk, userId: number): Promise<void> {
    if (!this.detail) return;
    const date = this.detail.date;
    const res = await fetch(`${BASE_URL}/api/desks/${desk.id}/bookings`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ date, userId }),
    });
    if (res.status === 204) {
      await this.refreshSnapshot();
      return;
    }
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    this.showFeedback(`Error: ${err.reason ?? res.status}`);
  }

  private async skipFixedDay(desk: Desk): Promise<void> {
    if (!this.detail) return;
    const date = this.detail.date;
    const res = await fetch(`${BASE_URL}/api/desks/${desk.id}/fixed/skip`, {
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
    this.showFeedback(`Error: ${err.reason ?? res.status}`);
  }

  private async unskipFixedDay(desk: Desk): Promise<void> {
    if (!this.detail) return;
    const date = this.detail.date;
    const res = await fetch(`${BASE_URL}/api/desks/${desk.id}/fixed/skip`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ date }),
    });
    if (res.ok || res.status === 204) {
      await this.refreshSnapshot();
      return;
    }
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    this.showFeedback(`Error: ${err.reason ?? res.status}`);
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
    this.renderNpcs();
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
