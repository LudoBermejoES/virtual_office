import type * as Phaser from "phaser";

export interface ArcadeButton {
  frame: Phaser.GameObjects.NineSlice;
  text: Phaser.GameObjects.Text;
}

export function arcadeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): ArcadeButton {
  const frame = scene.add
    .nineslice(x, y, "frame-9slice", 0, 200, 56, 16, 16, 16, 16)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  const text = scene.add
    .text(x, y, label, {
      fontFamily: '"Press Start 2P"',
      fontSize: "16px",
      color: "#f5f5f5",
    })
    .setOrigin(0.5)
    .setScrollFactor(0);

  frame.on("pointerdown", () => {
    text.setY(y + 2);
  });

  frame.on("pointerup", () => {
    text.setY(y);
    onClick();
  });

  return { frame, text };
}
