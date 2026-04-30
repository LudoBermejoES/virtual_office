import type * as Phaser from "phaser";

interface PoolOptions {
  cap?: number;
}

export class SpritePool {
  private readonly cap: number;

  constructor(options: PoolOptions = {}) {
    this.cap = options.cap ?? 100;
  }

  update(sprites: Phaser.GameObjects.Sprite[], camera: Phaser.Cameras.Scene2D.Camera): void {
    if (sprites.length === 0) return;

    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;

    const sorted = sprites
      .map((s, i) => {
        const dx = s.x - cx;
        const dy = s.y - cy;
        return { i, dist2: dx * dx + dy * dy };
      })
      .sort((a, b) => a.dist2 - b.dist2);

    const activeSet = new Set(sorted.slice(0, this.cap).map((e) => e.i));

    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i]!;
      if (activeSet.has(i)) {
        if (!s.anims.isPlaying) {
          s.anims.play({ key: s.anims.currentAnim?.key ?? "", repeat: -1 }, true);
        }
      } else {
        s.anims.stop();
        s.setFrame(0);
      }
    }
  }
}
