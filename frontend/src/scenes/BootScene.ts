import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.load.image("frame-9slice", "/assets/ui/frame-9slice.png");
    this.load.spritesheet("desk-sit", "/assets/sprites/desk-sit.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
    this.load.spritesheet("npc-cat-idle", "/assets/sprites/npc-cat.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("npc-bird-idle", "/assets/sprites/npc-bird.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("npc-roomba-idle", "/assets/sprites/npc-roomba.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("npc-plant-sway", "/assets/sprites/npc-plant.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
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
