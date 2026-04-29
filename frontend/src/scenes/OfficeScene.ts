import * as Phaser from "phaser";

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super({ key: "OfficeScene" });
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "OFFICE\n(próximamente)", {
        fontFamily: '"Press Start 2P"',
        fontSize: "14px",
        color: "#00ff9f",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5);
  }
}
