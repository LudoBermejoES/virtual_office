import * as Phaser from "phaser";
import { officesStore } from "../state/offices.js";
import { mountAdminPanel, unmountAdminPanel } from "../ui/admin-panel.js";

export class NoOfficeScene extends Phaser.Scene {
  private adminBtnEl: HTMLButtonElement | null = null;

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

    const { meRole } = officesStore.getState();
    if (meRole === "admin") {
      const btn = document.createElement("button");
      btn.id = "no-office-create-btn";
      btn.textContent = "CREAR PRIMERA OFICINA";
      Object.assign(btn.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, 60px)",
        background: "#36e36c",
        border: "none",
        color: "#0d0d1a",
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "12px",
        padding: "10px 20px",
        cursor: "pointer",
        zIndex: "50",
      });
      btn.addEventListener("click", () => mountAdminPanel("OFICINAS"));
      document.body.appendChild(btn);
      this.adminBtnEl = btn;
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.adminBtnEl?.remove();
      this.adminBtnEl = null;
      unmountAdminPanel();
    });
  }
}
