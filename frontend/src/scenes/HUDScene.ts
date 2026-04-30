import * as Phaser from "phaser";
import { formatLong } from "@virtual-office/shared";
import { uiStore } from "../state/ui.js";

export class HUDScene extends Phaser.Scene {
  private dateLabel: Phaser.GameObjects.Text | null = null;
  private prevBtn: Phaser.GameObjects.Text | null = null;
  private nextBtn: Phaser.GameObjects.Text | null = null;
  private todayBtn: Phaser.GameObjects.Text | null = null;
  private debounceUntil = 0;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super({ key: "HUDScene", active: false });
  }

  create(): void {
    const { width } = this.scale;

    this.prevBtn = this.add
      .text(width / 2 - 220, 20, "<", {
        fontFamily: '"Press Start 2P"',
        fontSize: "20px",
        color: "#00ff9f",
      })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.prevBtn.on("pointerdown", () => this.handlePrev());

    this.dateLabel = this.add
      .text(width / 2, 24, "", {
        fontFamily: '"VT323"',
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.nextBtn = this.add
      .text(width / 2 + 200, 20, ">", {
        fontFamily: '"Press Start 2P"',
        fontSize: "20px",
        color: "#00ff9f",
      })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.nextBtn.on("pointerdown", () => this.handleNext());

    this.todayBtn = this.add
      .text(width - 100, 24, "[Hoy]", {
        fontFamily: '"Press Start 2P"',
        fontSize: "12px",
        color: "#ffff00",
      })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.todayBtn.on("pointerdown", () => this.handleToday());

    this.input.keyboard?.on("keydown-LEFT", () => this.handlePrev());
    this.input.keyboard?.on("keydown-RIGHT", () => this.handleNext());
    this.input.keyboard?.on("keydown-HOME", () => this.handleToday());

    this.refresh();
    this.unsubscribe = uiStore.subscribe(() => this.refresh());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });
  }

  private refresh(): void {
    const state = uiStore.getState();
    const isToday = state.selectedDate === state.today;
    this.dateLabel?.setText(formatLong(state.selectedDate, "es-ES"));
    this.prevBtn?.setColor(state.canPrev() ? "#00ff9f" : "#444444");
    this.nextBtn?.setColor(state.canNext() ? "#00ff9f" : "#444444");
    this.todayBtn?.setVisible(!isToday);
  }

  private withinDebounce(): boolean {
    const now = Date.now();
    if (now < this.debounceUntil) return true;
    this.debounceUntil = now + 150;
    return false;
  }

  private handlePrev(): void {
    if (this.withinDebounce()) return;
    if (uiStore.getState().canPrev()) uiStore.getState().prev();
  }

  private handleNext(): void {
    if (this.withinDebounce()) return;
    if (uiStore.getState().canNext()) uiStore.getState().next();
  }

  private handleToday(): void {
    if (this.withinDebounce()) return;
    uiStore.getState().resetToToday();
  }
}
