import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.load.image("frame-9slice", "/assets/ui/frame-9slice.png");
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, "PRESS START\nLOADING...", {
        fontFamily: '"Press Start 2P"',
        fontSize: "16px",
        color: "#36e36c",
        align: "center",
        lineSpacing: 12,
      })
      .setOrigin(0.5);

    this.checkHealth();
  }

  private checkHealth(): void {
    fetch(`${BASE_URL}/healthz`)
      .then((res) => res.json())
      .then((data: unknown) => {
        const status = (data as { status?: string }).status ?? "unknown";
        console.info("[BootScene] health:", status);
      })
      .catch((err: unknown) => {
        console.warn("[BootScene] healthz no disponible:", err);
      });
  }
}
