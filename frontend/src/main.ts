import "./style.css";
import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { LoginScene } from "./scenes/LoginScene.js";
import { OfficeScene } from "./scenes/OfficeScene.js";
import { AdminMapScene } from "./scenes/AdminMapScene.js";
import { HUDScene } from "./scenes/HUDScene.js";

async function preloadFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load('12px "Press Start 2P"'),
    document.fonts.load('16px "VT323"'),
  ]);
}

function captureInviteToken(): void {
  const match = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)\/?$/);
  if (match && match[1]) {
    localStorage.setItem("inviteToken", match[1]);
    window.history.replaceState({}, "", "/");
  }
}

async function main(): Promise<void> {
  captureInviteToken();
  await preloadFonts();

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#0b0d1a",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: false,
    },
    scene: [BootScene, LoginScene, OfficeScene, AdminMapScene, HUDScene],
  });
}

main().catch(console.error);
