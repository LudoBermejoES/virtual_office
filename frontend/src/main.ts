import "./style.css";
import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { LoginScene } from "./scenes/LoginScene.js";
import { OfficeScene } from "./scenes/OfficeScene.js";

async function preloadFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load('12px "Press Start 2P"'),
    document.fonts.load('16px "VT323"'),
  ]);
}

async function main(): Promise<void> {
  await preloadFonts();

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#0d0d1a",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: false,
    },
    scene: [BootScene, LoginScene, OfficeScene],
  });
}

main().catch(console.error);
