import type * as Phaser from "phaser";
import type { NpcData, NpcSprite } from "@virtual-office/shared";

const NPC_SPRITE_KEYS: Record<NpcSprite, string> = {
  "cat-idle": "npc-cat-idle",
  "bird-idle": "npc-bird-idle",
  "roomba-idle": "npc-roomba-idle",
  "plant-sway": "npc-plant-sway",
};

const VALID_SPRITES = new Set<string>(Object.keys(NPC_SPRITE_KEYS));

export function renderNpcs(scene: Phaser.Scene, npcs: NpcData[]): Phaser.GameObjects.Sprite[] {
  const result: Phaser.GameObjects.Sprite[] = [];
  for (const npc of npcs) {
    if (!VALID_SPRITES.has(npc.sprite)) continue;
    const textureKey = NPC_SPRITE_KEYS[npc.sprite as NpcSprite];
    if (!scene.textures.exists(textureKey)) continue;
    const sprite = scene.add.sprite(npc.x, npc.y, textureKey, 0);
    sprite.setDepth(-5);
    const animKey = `npc-${npc.sprite}`;
    if (scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }
    result.push(sprite);
  }
  return result;
}
