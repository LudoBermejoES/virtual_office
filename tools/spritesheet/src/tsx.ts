import { basename, extname } from "node:path";
import type { Layout } from "./layout.js";

export interface TsxOptions {
  imageFilename: string;
  duration: number;
  tilesetName: string;
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

function stripBasename(filename: string): string {
  return basename(filename, extname(filename));
}

export function buildTsxXml(layout: Layout, options: TsxOptions): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<tileset version="1.10" tiledversion="1.12.1" name="${escapeXml(options.tilesetName)}" tilewidth="${layout.tile}" tileheight="${layout.tile}" tilecount="${layout.totalTiles}" columns="${layout.cols}">`,
  );
  lines.push(
    ` <image source="${escapeXml(options.imageFilename)}" width="${layout.outWidth}" height="${layout.outHeight}"/>`,
  );

  for (const p of layout.placements) {
    const animName = stripBasename(p.strip.filename);
    lines.push(` <tile id="${p.firstLocalId}">`);
    lines.push("  <properties>");
    lines.push(`   <property name="name" value="${escapeXml(animName)}"/>`);
    lines.push("  </properties>");
    if (p.strip.frameCount > 1) {
      lines.push("  <animation>");
      for (let i = 0; i < p.strip.frameCount; i++) {
        lines.push(`   <frame tileid="${p.firstLocalId + i}" duration="${options.duration}"/>`);
      }
      lines.push("  </animation>");
    }
    lines.push(" </tile>");
  }

  lines.push("</tileset>");
  return lines.join("\n") + "\n";
}
