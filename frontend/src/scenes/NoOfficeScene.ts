import * as Phaser from "phaser";

export class NoOfficeScene extends Phaser.Scene {
  constructor() {
    super({ key: "NoOfficeScene" });
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "Aún no hay oficinas.\nPide a un admin que cree una.", {
        fontFamily: '"VT323"',
        fontSize: "24px",
        color: "#8e92a8",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5);
  }
}
