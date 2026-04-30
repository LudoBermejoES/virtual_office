const NPC_SPRITE_ENUM = new Set(["cat-idle", "bird-idle", "roomba-idle", "plant-sway"]);
const MAX_NPCS = 50;

export interface TileAnimation {
  tileId: number;
  frames: { tileid: number; duration: number }[];
}

export interface TilesetAnimations {
  ordinal: number;
  animations: TileAnimation[];
}

export interface NpcEntry {
  name: string;
  x: number;
  y: number;
  sprite: string;
}

export interface AnimationsAndNpcs {
  tilesetAnimations: TilesetAnimations[];
  npcs: NpcEntry[];
  npcWarnings: string[];
}

export function parseTiledAnimationsAndNpcs(
  tmj: Record<string, unknown>,
): AnimationsAndNpcs | { error: string } {
  const tilesets = (tmj["tilesets"] as Record<string, unknown>[]) ?? [];
  const layers = (tmj["layers"] as Record<string, unknown>[]) ?? [];

  const tilesetAnimations: TilesetAnimations[] = tilesets.map((ts, ordinal) => {
    const tiles = (ts["tiles"] as Array<Record<string, unknown>>) ?? [];
    const animations: TileAnimation[] = [];
    for (const tile of tiles) {
      const rawAnim = tile["animation"] as Array<{ tileid: number; duration: number }> | undefined;
      if (rawAnim && Array.isArray(rawAnim) && rawAnim.length > 0) {
        const tileId = tile["id"] as number;
        animations.push({ tileId, frames: rawAnim });
      }
    }
    return { ordinal, animations };
  });

  const npcs: NpcEntry[] = [];
  const npcWarnings: string[] = [];

  for (const layer of layers) {
    if (layer["type"] !== "objectgroup" || layer["name"] !== "npcs") continue;
    const objects = (layer["objects"] as Record<string, unknown>[]) ?? [];

    if (objects.length > MAX_NPCS) {
      return { error: "too_many_npcs" };
    }

    for (const obj of objects) {
      const name = (obj["name"] as string) ?? "";
      const x = (obj["x"] as number) ?? 0;
      const y = (obj["y"] as number) ?? 0;
      const props = (obj["properties"] as Array<{ name: string; value: unknown }>) ?? [];
      const spriteProp = props.find((p) => p.name === "sprite");
      const sprite = String(spriteProp?.value ?? "");

      if (!NPC_SPRITE_ENUM.has(sprite)) {
        npcWarnings.push(`NPC "${name}": sprite desconocido "${sprite}", descartado`);
        continue;
      }
      npcs.push({ name, x, y, sprite });
    }
  }

  return { tilesetAnimations, npcs, npcWarnings };
}
