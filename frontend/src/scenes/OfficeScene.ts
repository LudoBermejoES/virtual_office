import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";

interface OfficeData {
  id: number;
  name: string;
  tmj_filename: string;
  tile_width: number;
  tile_height: number;
  cells_x: number;
  cells_y: number;
  map_width: number;
  map_height: number;
  tilesets: Array<{ ordinal: number; image_name: string; filename: string }>;
}

export class OfficeScene extends Phaser.Scene {
  private office: OfficeData | null = null;

  constructor() {
    super({ key: "OfficeScene" });
  }

  init(data: { office?: OfficeData }): void {
    this.office = data?.office ?? null;
  }

  preload(): void {
    if (!this.office) return;
    const o = this.office;
    this.load.tilemapTiledJSON("office", `${BASE_URL}/maps/${o.id}/${o.tmj_filename}`);
    for (const t of o.tilesets) {
      this.load.image(`tiles:${o.id}:${t.ordinal}`, `${BASE_URL}/maps/${o.id}/${t.filename}`);
    }
  }

  create(): void {
    if (!this.office) {
      const { width, height } = this.scale;
      this.add
        .text(width / 2, height / 2, "OFFICE\n(sin mapa cargado)", {
          fontFamily: '"Press Start 2P"',
          fontSize: "14px",
          color: "#00ff9f",
          align: "center",
          lineSpacing: 10,
        })
        .setOrigin(0.5);
      return;
    }

    const o = this.office;
    const map = this.make.tilemap({ key: "office" });
    const tilesetObjs: Phaser.Tilemaps.Tileset[] = [];
    for (const t of o.tilesets) {
      const name = t.image_name.replace(/\.[^.]+$/, "");
      const ts = map.addTilesetImage(name, `tiles:${o.id}:${t.ordinal}`);
      if (ts) tilesetObjs.push(ts);
    }
    for (const layer of map.layers) {
      map.createLayer(layer.name, tilesetObjs);
    }
  }
}

export function computeMapScale(
  canvasWidth: number,
  canvasHeight: number,
  mapWidth: number,
  mapHeight: number,
): number {
  if (mapWidth <= 0 || mapHeight <= 0) return 1;
  return Math.min(canvasWidth / mapWidth, canvasHeight / mapHeight);
}
