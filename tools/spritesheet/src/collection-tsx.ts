import { basename, extname } from "node:path";
import type { EffectiveSize } from "./mode-detection.js";

export interface CollectionTile {
  size: EffectiveSize;
  rowIndex: number;
  /** Path relativo desde el .tsx hasta el PNG (incluye subdir _assets). */
  imageRelPath: string;
}

export interface CollectionTsxOptions {
  tilesetName: string;
  duration: number;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return ch;
    }
  });
}

function stripBasenameNoExt(filename: string): string {
  return basename(filename, extname(filename));
}

export function buildImageCollectionTsx(
  tiles: CollectionTile[],
  options: CollectionTsxOptions,
): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<tileset version="1.10" tiledversion="1.12.1" name="${escapeXml(options.tilesetName)}" tilewidth="${tiles[0]?.size.frame_width ?? 0}" tileheight="${tiles[0]?.size.frame_height ?? 0}" tilecount="${tiles.length}" columns="0">`,
  );
  lines.push(' <grid orientation="orthogonal" width="1" height="1"/>');

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]!;
    const baseName = stripBasenameNoExt(tile.size.png.filename);
    const animName = tile.size.row_count > 1 ? `${baseName}__row${tile.rowIndex}` : baseName;

    lines.push(` <tile id="${i}">`);
    lines.push("  <properties>");
    lines.push(`   <property name="name" value="${escapeXml(animName)}"/>`);
    lines.push(`   <property name="frame_width" type="int" value="${tile.size.frame_width}"/>`);
    lines.push(`   <property name="frame_height" type="int" value="${tile.size.frame_height}"/>`);
    lines.push(`   <property name="frame_count" type="int" value="${tile.size.frame_count}"/>`);
    lines.push(`   <property name="row_index" type="int" value="${tile.rowIndex}"/>`);
    lines.push(`   <property name="duration_ms" type="int" value="${options.duration}"/>`);
    lines.push("  </properties>");
    lines.push(
      `  <image source="${escapeXml(tile.imageRelPath)}" width="${tile.size.png.width}" height="${tile.size.png.height}"/>`,
    );
    lines.push(" </tile>");
  }

  lines.push("</tileset>");
  return lines.join("\n") + "\n";
}
