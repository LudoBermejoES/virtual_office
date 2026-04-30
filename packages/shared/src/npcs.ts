export type NpcSprite = "cat-idle" | "bird-idle" | "roomba-idle" | "plant-sway";

export interface NpcData {
  id: number;
  name: string;
  x: number;
  y: number;
  sprite: NpcSprite;
}
