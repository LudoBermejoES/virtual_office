import * as Phaser from "phaser";
import { formatLong } from "@virtual-office/shared";
import { uiStore } from "../state/ui.js";
import { arcadeButton } from "../ui/arcade-button.js";
import type { ArcadeButton } from "../ui/arcade-button.js";
import { soundManager } from "../ui/sound.js";

export class HUDScene extends Phaser.Scene {
  private dateLabel: Phaser.GameObjects.Text | null = null;
  private prevBtn: ArcadeButton | null = null;
  private nextBtn: ArcadeButton | null = null;
  private todayBtn: ArcadeButton | null = null;
  private muteBtn: Phaser.GameObjects.Text | null = null;
  private debounceUntil = 0;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super({ key: "HUDScene", active: false });
  }

  create(): void {
    const { width } = this.scale;

    this.prevBtn = arcadeButton(this, width / 2 - 220, 28, "<", () => this.handlePrev());
    this.nextBtn = arcadeButton(this, width / 2 + 220, 28, ">", () => this.handleNext());
    this.todayBtn = arcadeButton(this, width - 120, 28, "HOY", () => this.handleToday());

    this.dateLabel = this.add
      .text(width / 2, 28, "", {
        fontFamily: '"VT323"',
        fontSize: "22px",
        color: "#f5f5f5",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.muteBtn = this.add
      .text(width - 32, 28, this.muteIcon(), {
        fontFamily: '"Press Start 2P"',
        fontSize: "14px",
        color: "#8e92a8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on("pointerdown", () => this.handleMuteToggle());

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

  private muteIcon(): string {
    return soundManager.isMuted() ? "[M]" : "[S]";
  }

  private handleMuteToggle(): void {
    soundManager.toggle();
    this.muteBtn?.setText(this.muteIcon());
    soundManager.play("beep-click");
  }

  private refresh(): void {
    const state = uiStore.getState();
    const isToday = state.selectedDate === state.today;
    this.dateLabel?.setText(formatLong(state.selectedDate, "es-ES"));
    this.prevBtn?.text.setColor(state.canPrev() ? "#36e36c" : "#8e92a8");
    this.nextBtn?.text.setColor(state.canNext() ? "#36e36c" : "#8e92a8");
    this.todayBtn?.frame.setVisible(!isToday);
    this.todayBtn?.text.setVisible(!isToday);
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
